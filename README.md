## StreamingJS
An HTML5 media center built with Node.js

#### Dependencies
- express
    - For handling and routing server requests
    - `npm install express`
- mime
    - For determining the MIME type of files based on extension
    - `npm install mime`
- cheerio
    - For manipulating the DOM of the template pages to render a final page
    - `npm install cheerio`
- marked
    - For rendering Markdown into HTML
    - `npm install marked`
- pygmentize-bundled
    - For providing a wrapper to Pygments which is used to style code files and code blocks within Markdown
    - `npm install pygmentize-bundled`

###### Install all
`npm install express mime cheerio marked pygmentize-bundled`

**You must change the directory path on `Line 12` to the uppermost directory you want people to access**