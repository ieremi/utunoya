# Utunoya

A live manuscript-style preview for Visual Studio Code.

Utunoya renders the active document as vertical Japanese manuscript paper
(原稿用紙)-style text wrapped at fifteen cells per line, and shows a live
character count in the status bar as you type.

## Features

- **Manuscript preview** — opens a read-only preview beside the editor that
  wraps text at fifteen manuscript cells (30 half-width units) per line.
- **Live character count** — the status bar shows the manuscript cell count
  for the active document, updating as you edit.
- Full-width characters (including Japanese text) count as two units;
  half-width alphanumerics, parentheses, and spaces count as one unit.

## Usage

1. Open a text document.
2. Run the **Utunoya: Open Utunoya Preview** command from the Command
   Palette (`utunoya.open`).
3. The preview opens beside the editor and updates automatically as the
   source document changes.

## License

[MIT](LICENSE)
