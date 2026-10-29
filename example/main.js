// Minimal Electron app: lists products, buys one, finishes it.
// StoreKit only answers a signed app whose bundle id has products in App
// Store Connect, so set PRODUCT_IDS and run a signed build to see real data.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const storekit = require('electron-storekit');

const productIds = (process.env.PRODUCT_IDS ?? 'com.example.pro.monthly').split(',');

async function deliver(transaction) {
  // Real apps send transaction.signedTransaction to their server, verify it
  // there, and finish only after the server has recorded it.
  console.log('transaction', transaction.productId, transaction.id, transaction.environment);
  await storekit.finish(transaction.id);
}

app.whenReady().then(() => {
  storekit.onTransaction((transaction) => {
    deliver(transaction).catch((error) => console.error('finish failed', error));
  });

  ipcMain.handle('products', () => storekit.products(productIds));
  ipcMain.handle('purchase', async (_event, productId) => {
    const result = await storekit.purchase(productId);
    if (result.transaction) {
      await deliver(result.transaction);
    }
    return result.outcome;
  });
  ipcMain.handle('restore', async () => {
    await storekit.sync();
    return storekit.currentEntitlements();
  });

  const window = new BrowserWindow({
    width: 520,
    height: 420,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  window.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());
