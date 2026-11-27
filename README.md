# Forma Website Builder

Forma turns a short project brief into a responsive website preview. It is a front-end engineering project built with HTML, CSS, and vanilla JavaScript. It does not require a framework, package installation, or a back-end service.

## Project structure

| File | Responsibility |
| --- | --- |
| `index.html` | Product landing page, example templates, and the website brief form. |
| `styles.css` | Landing page design, form controls, upload previews, and responsive layouts. |
| `script.js` | Draft saving, image handling, HTML generation, live preview, and file download. |

## How the builder works

1. The user fills in the brief and selects a visual style.
2. Text fields are saved in the browser's local storage.
3. Optional image uploads are resized in the browser. A logo and up to four photos can be added.
4. JavaScript combines the brief, style settings, and images into one HTML document.
5. The document appears in the live preview and can be downloaded as a standalone `.html` file.

Uploaded images stay on the user's device. They are embedded into the generated HTML instead of being sent to a server. The current brief does not persist uploaded images after a page refresh.


The site uses Google Fonts and, when the user has not uploaded photos, sample images from Unsplash. Those remote assets need an internet connection.

## Suggested code tour

- Start with the semantic page sections and form fields in `index.html`.
- Read the CSS variables and responsive breakpoints in `styles.css`.
- In `script.js`, follow `readBrief()` → `makeWebsite()` → `showPreview()` to see how input becomes a site.
- Review `optimizeImage()` and the image upload handlers to see how local media is prepared for export.
