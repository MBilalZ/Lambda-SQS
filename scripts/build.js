const esbuild = require('esbuild');
const fs = require('fs');
const archiver = require('archiver');

// Paths
const entryFile = './src/index.js'; // The entry point of your Lambda function
const outputFile = './target/index.js'; // The output bundle file
const zipFile = './lambda.zip'; // The final zip file

// Bundle the code using esbuild
function bundleCode() {
  return new Promise((resolve, reject) => {
    esbuild
      .build({
        entryPoints: [entryFile],
        bundle: true,
        platform: 'node',
        outfile: outputFile,
        minify: false, // Set to true if you want minification
        sourcemap: false, // Set to true if you want source maps
      })
      .then(() => {
        console.log('Code bundled successfully.');
        resolve();
      })
      .catch((error) => {
        console.error('esbuild Error:', error);
        reject(error);
      });
  });
}

// Zip the bundled file
function zipBundle() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Zipped ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('Archiver Error:', err);
      reject(err);
    });

    archive.pipe(output);

    // Add bundled file to the archive
    archive.file(outputFile, { name: 'index.js' });

    archive.finalize();
  });
}

// Run the build and zip process
async function buildAndZip() {
  try {
    console.log('Bundling code...');
    await bundleCode();

    console.log('Zipping bundle...');
    await zipBundle();
    console.log('Bundle zipped successfully.');
  } catch (error) {
    console.error('Error:', error);
  }
}

buildAndZip();
