# Word's own reply comments

`word16-replies.docx` is a file saved by Microsoft Word 16. It is the test fixture
`tests/testthat/docs_dir/test-docx_comments.docx` of the R package
[officer](https://github.com/davidgohel/officer), version 0.7.8, which is MIT licensed
(© 2022 ArData).

It is kept as the shape of comments and replies as Word writes them
(round-trip-plan-2.md, T5.0). It has 16 comments, four of them replies, one of those a reply
to a reply, in five parts: `comments.xml`, `commentsExtended.xml` (`w15:paraIdParent`,
`w15:done`), `commentsIds.xml`, `commentsExtensible.xml` and `people.xml`.

**Changed from the original:** the person who saved it is replaced by the comments' own
author, "Author Me", in `docProps/core.xml` and `word/people.xml`. The sign-in that
`people.xml` held is replaced too, and the company in `docProps/app.xml` is emptied. Nothing
else is changed.
