# HTML Partials

Build-time includes via marcador `<!-- @include ./path/to/file.html -->`.

## Contrato

- Marcador: `<!-- @include ./relative/path.html -->`
- Caminhos relativos ao arquivo que contém o include
- Suporta recursão (ex: settings/_wrapper.html inclui tabs/*.html)
- Include circular lança erro em tempo de build

## Build

O `build-renderer.js` processa includes ANTES de copiar para `dist/`.
