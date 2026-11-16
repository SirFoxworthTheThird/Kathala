#!/usr/bin/env bash
#
# The repository's GitHub Project board, kept from a workflow run
# (.github/workflows/project-board.yml).
#
# A Project belongs to its owner, not to the repository, so it is reached with
# a token of the owner's that may edit Projects, saved as the repository secret
# PROJECT_TOKEN. Run by hand from the Actions tab, or by `workflow_dispatch`.
#
#   BOARD_ACTION=setup   the board made if there is none by PROJECT_TITLE, linked to
#                        the repository, and its fields made where missing
#   BOARD_ACTION=list    every item on the board, with its fields, printed
#   BOARD_ACTION=apply   BOARD_OPS, a JSON array, each one of:
#                          {"op":"add","issue":697,"fields":{"Priority":"P1","Status":"Todo"}}
#                          {"op":"add","pr":693}              (a pull request)
#                          {"op":"archive","issue":702}
#                          {"op":"remove","issue":702}
#                        "add" adds the item if it is not there, and sets each field
#                        named: a single-select by its option's name, any other as text.
#
# What the inputs say reaches `gh` as arguments, never as shell text: nothing
# typed into an issue or a run's inputs can be run as a command.

set -euo pipefail

if [ -z "${GH_TOKEN:-}" ]; then
  echo "::error::No PROJECT_TOKEN secret. Create a classic token with the 'project' scope (and 'repo' if the repository is private), and save it as a repository secret named PROJECT_TOKEN."
  exit 1
fi
OWNER="${PROJECT_OWNER:?PROJECT_OWNER not set}"
REPO="${PROJECT_REPO:?PROJECT_REPO not set}"
TITLE="${PROJECT_TITLE:?PROJECT_TITLE not set}"
ACTION="${BOARD_ACTION:?BOARD_ACTION not set}"

# The fields `setup` makes, beside the Status every board has: name, then its options.
FIELDS=(
  "Priority|P1,P2,P3"
  "Group|Clear gap,Partly there,Not settled"
)

say() { echo "$*"; if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$*" >>"$GITHUB_STEP_SUMMARY"; fi; }

board_number() {
  gh project list --owner "$OWNER" --format json --limit 100 |
    jq -r --arg t "$TITLE" '[.projects[] | select(.title == $t)][0].number // empty'
}

need_board() {
  NUMBER="$(board_number)"
  if [ -z "$NUMBER" ]; then
    echo "::error::No project titled '$TITLE' for $OWNER. Run the workflow with action 'setup' first."
    exit 1
  fi
  PROJECT_ID="$(gh project view "$NUMBER" --owner "$OWNER" --format json | jq -r .id)"
  FIELD_LIST="$(gh project field-list "$NUMBER" --owner "$OWNER" --format json --limit 100)"
}

setup() {
  NUMBER="$(board_number)"
  if [ -z "$NUMBER" ]; then
    NUMBER="$(gh project create --owner "$OWNER" --title "$TITLE" --format json | jq -r .number)"
    say "Made the project '$TITLE', #$NUMBER."
  else
    say "The project '$TITLE' is #$NUMBER already."
  fi
  # Linked, so it shows on the repository's Projects tab. Linking twice is refused, harmlessly.
  if gh project link "$NUMBER" --owner "$OWNER" --repo "$REPO" >/dev/null 2>&1; then say "Linked to $REPO."; fi
  local have
  have="$(gh project field-list "$NUMBER" --owner "$OWNER" --format json --limit 100)"
  for spec in "${FIELDS[@]}"; do
    local name="${spec%%|*}" options="${spec#*|}"
    if jq -e --arg n "$name" 'any(.fields[]; .name == $n)' <<<"$have" >/dev/null; then
      say "The field '$name' is there already."
    else
      gh project field-create "$NUMBER" --owner "$OWNER" --name "$name" --data-type SINGLE_SELECT --single-select-options "$options" >/dev/null
      say "Made the field '$name': $options."
    fi
  done
  say "Board: $(gh project view "$NUMBER" --owner "$OWNER" --format json | jq -r .url)"
}

# The URL of an op's issue or pull request; its number checked to be one.
url_of() {
  local op="$1" n kind
  if n="$(jq -er '.issue // empty' <<<"$op")"; then kind=issues
  elif n="$(jq -er '.pr // empty' <<<"$op")"; then kind=pull
  else echo "::error::An op names no issue or pr: $op" >&2; return 1
  fi
  # To the log, not to the caller, which takes what this prints as the URL.
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then echo "::error::Not a number: $n" >&2; return 1; fi
  echo "https://github.com/$REPO/$kind/$n"
}

# An item already on the board, by its issue or PR's URL; empty where it is not.
item_on_board() {
  gh project item-list "$NUMBER" --owner "$OWNER" --format json --limit 1000 |
    jq -r --arg u "$1" '[.items[] | select(.content.url == $u)][0].id // empty'
}

set_field() {
  local item="$1" name="$2" value="$3" field type
  field="$(jq -c --arg n "$name" '[.fields[] | select(.name == $n)][0] // empty' <<<"$FIELD_LIST")"
  if [ -z "$field" ]; then echo "::error::No field '$name' on the board."; return 1; fi
  type="$(jq -r .type <<<"$field")"
  local args=(--id "$item" --project-id "$PROJECT_ID" --field-id "$(jq -r .id <<<"$field")")
  case "$type" in
    ProjectV2SingleSelectField)
      local option
      option="$(jq -r --arg v "$value" '[.options[] | select(.name == $v)][0].id // empty' <<<"$field")"
      if [ -z "$option" ]; then echo "::error::'$name' has no option '$value'."; return 1; fi
      args+=(--single-select-option-id "$option") ;;
    *)
      # Any other field is set as text: the board's own fields are single-selects.
      args+=(--text "$value") ;;
  esac
  gh project item-edit "${args[@]}" >/dev/null
}

apply() {
  need_board
  local ops="${BOARD_OPS:-[]}" count
  if ! count="$(jq -e 'if type == "array" then length else error("not an array") end' <<<"$ops")"; then
    echo "::error::BOARD_OPS is not a JSON array."
    exit 1
  fi
  local failed=0
  for ((k = 0; k < count; k++)); do
    local op url verb item
    op="$(jq -c ".[$k]" <<<"$ops")"
    verb="$(jq -r '.op // "add"' <<<"$op")"
    if ! url="$(url_of "$op")"; then failed=1; continue; fi
    case "$verb" in
      add)
        item="$(gh project item-add "$NUMBER" --owner "$OWNER" --url "$url" --format json | jq -r .id)"
        local fields
        fields="$(jq -c '(.fields // {}) | to_entries[]' <<<"$op")"
        local said=()
        while IFS= read -r entry; do
          [ -z "$entry" ] && continue
          local name value
          name="$(jq -r .key <<<"$entry")"
          value="$(jq -r .value <<<"$entry")"
          if set_field "$item" "$name" "$value"; then said+=("$name: $value"); else failed=1; fi
        done <<<"$fields"
        say "On the board: $url${said:+ (${said[*]})}" ;;
      archive | remove)
        item="$(item_on_board "$url")"
        if [ -z "$item" ]; then say "Not on the board, nothing to $verb: $url"; continue; fi
        if [ "$verb" = archive ]; then
          gh project item-archive "$NUMBER" --owner "$OWNER" --id "$item" >/dev/null
          say "Archived: $url"
        else
          gh project item-delete "$NUMBER" --owner "$OWNER" --id "$item" >/dev/null
          say "Taken off the board: $url"
        fi ;;
      *) echo "::error::Unknown op '$verb' in $op"; failed=1 ;;
    esac
  done
  return "$failed"
}

list() {
  need_board
  local items
  items="$(gh project item-list "$NUMBER" --owner "$OWNER" --format json --limit 1000)"
  say "## $TITLE: $(jq '.items | length' <<<"$items") items"
  say ""
  # Every field an item has besides its content, as name: value.
  jq -r '.items[] | "- #\(.content.number // "?") \(.content.title // .title // "untitled") — " +
    ([to_entries[] | select(.key as $k | ["id","content","title","labels","repository","assignees","milestone"] | index($k) | not)
      | "\(.key): \(.value)"] | join(", "))' <<<"$items" | while IFS= read -r line; do say "$line"; done
  # And whole, for a reader of the log that wants every field as the board has it.
  echo "::group::The board as JSON"
  echo "$items"
  echo "::endgroup::"
}

case "$ACTION" in
  setup) setup ;;
  list) list ;;
  apply) apply ;;
  *) echo "::error::Unknown action '$ACTION': setup, list or apply."; exit 1 ;;
esac
