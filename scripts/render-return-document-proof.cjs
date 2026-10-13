const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoDir = path.resolve(__dirname, '..');
const outputPath = path.resolve(process.argv[2] || path.join(repoDir, 'tmp/pdfs/return-document-proof.pdf'));
const profileName = process.argv[3] || 'ApplyPanel';
const requestedItemCount = Math.max(1, Number(process.argv[4]) || 3);

const sampleItems = [
  ['大土豆', 2, '测试质量'],
  ['红黄彩椒各', 5, '规格不符'],
  ['绿甘蓝', 22.8, '客户退订'],
];

const items = Array.from({ length: requestedItemCount }, (_unused, index) => {
  const sample = sampleItems[index % sampleItems.length];
  return {
    nxDsriGoodsName: requestedItemCount > sampleItems.length ? `${sample[0]}${index + 1}` : sample[0],
    nxDsriUnit: '斤',
    nxDsriApprovedQuantity: sample[1],
    nxDsriPickedQuantity: null,
    nxDsriReason: sample[2],
  };
});

const payload = {
  customerPrintName: profileName,
  originalBillNo: 'LZPS-09-11-FYVY',
  job: { nxDrpjDocumentType: 'CUSTOMER_HANDOVER' },
  salesReturn: {
    nxDsrNo: 'RT20260919103210580F4938',
    customerName: '二十',
    nxDsrRouteDate: '2026-09-19',
    nxDsrCreatedAt: '2026-09-19T10:32:10+08:00',
    nxDsrEstimatedCreditAmount: 6,
    nxDsrPickupRemark: '-',
    items,
  },
};

async function render() {
  const { buildReturnDocumentHtml, resolveReturnPrintProfile } = await import('../vue/src/modules/returns/services/returnDocumentTemplate.js');
  const profile = resolveReturnPrintProfile(profileName);
  const html = buildReturnDocumentHtml(payload, '粒子配送');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath.replace(/\.pdf$/i, '.html'), html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: {
        width: Math.round(profile.widthMm * 1000),
        height: Math.round(profile.heightMm * 1000),
      },
      marginsType: 0,
    });
    await writeFile(outputPath, pdf);
    process.stdout.write(`${outputPath}\n`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    app.quit();
  }
}

app.whenReady().then(render).catch((error) => {
  console.error(error);
  app.exit(1);
});
