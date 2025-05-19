# obsidian-plugin-email-importer-via-imap

This is a simple plugin for Obsidian that allows you to import emails from your email account via IMAP. 

For now, it has only been tested with my own email account, but it should work with any email account that supports IMAP. Use at your own risk.

Currently only plaintext is supported, no attachments. The content of the email is imported as a markdown file, with the receiving date as the filename.

The IMAP interface [is documented here](./src/imap/README.md).

# Development

- Pull and run `npm i`
- Run `npm run dev` to start watching for changes
- Hint: link to vault for live changes:
  - `ln main.js /vault`
  - `ln manifest.json /vault`
