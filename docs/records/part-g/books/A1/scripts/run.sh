#!/bin/bash
# usage: run.sh file.js   OR   run.sh -e 'js code'
if [ "$1" = "-e" ]; then
  printf '%s' "$2" | curl -s --max-time 600 --data-binary @- http://127.0.0.1:5311/
else
  curl -s --max-time 600 --data-binary @"$1" http://127.0.0.1:5311/
fi
echo
