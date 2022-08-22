Thanks to [@MikeRatcliffe](https://github.com/MikeRatcliffe) for putting this very helpful list together!
(https://github.com/markdown-it/markdown-it/issues/289)

```js
'autolink',      // Automatically convert link text surrounded by angle brackets to <a> tags
'backticks',     // Allow inline code blocks using backticks
'blockquote',    // > I am a blockquote becomes <blockquote>I am a blockquote</blockquote>
'code',          // Code block (4 spaces padded)
'emphasis',      // *Emphasize* _emphasize_ **Strong** __Strong__
'entity',        // Parse HTML entities e.g. &amp;
'escape',        // Automatically escape special characters.
'fence',         // Fenced code blocks
'heading',       // # Foo becomes <h1>Foo</h1>. ###### becomes <h6>Foo</h6>
'hr',            // ***, --- and ___ produce a <hr> tag.
'html_block',    // Enable / disable HTML blocks.
'html_inline',   // Enable / disable inline HTML.
'image'          // Enable / disable inline images.
'lheading',      // Use === or --- underneath text for h1 and h2 blocks.
'link',          // Process [link](<to> "stuff")
'linkify',       // Replace link-like texts with link nodes.
'list',          // Ordered and unordered lists.
'newline',       // '  \n' -> <br>
'normalize',     // Replace newlines with \n, null characters and convert tabs to spaces.
'paragraph'      // Use blank lines to indicate a paragraph.
'reference',     // Reference style links e.g. [an example][id] reference-style link... further down in the document [id]: http://example.com/  "Optional Title Here"
'strikethrough', // ~~strike through~~
'table',         // GFM style tables
'text_collapse', // Merge adjacent text nodes into one, and re-calculate all token levels
```
