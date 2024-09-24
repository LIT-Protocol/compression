# Compression

This package contains examples of how to use the Lit Protocol to compress or bundle data before encrypting and decrypting it using Lit Protocol.

## Examples

### Zip and encrypt a string

The most basic example of using the Lit Protocol to compress any string before encrypting it. Check out the `zipAndEncryptString.ts` file for a full example.

### Zip and encrypt multiple files

Another example of using the Lit Protocol to compress multiple files before encrypting them. Check out the `zipAndEncryptMultipleFiles.ts` file for a full example.

### Zip and encrypt a file and bundle with metadata

A more advanced example of using the Lit Protocol to compress a file and bundle it with metadata before encrypting everything together. Check out the `zipFileAndBundleWithMetadata.ts` file for a full example.
This use case is useful to generate one self-contained file that can be shared with others without them needing to handle the cyphertext and metadata separately.

## Running the examples

To run the examples, you will need to have Node.js installed on your machine. You can then run the following commands in the terminal:

```bash
npm install
npm run run:zipAndEncryptString
npm run run:zipAndEncryptMultipleFiles
npm run run:zipFileAndBundleWithMetadata
```

These commands will run the corresponding example file and output the encrypted data and the hash of the encrypted data.
