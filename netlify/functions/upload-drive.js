/**
 * upload-drive.js (Netlify Function)
 * - Upload PDF/Excel su Drive (OAuth utente app.misericordia25)
 * - Crea albero: ROOT / ANNO / MODULO / MESE
 * - Invia email (Nodemailer)
 */

const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const { Readable } = require("stream");

/* =====================================================
   ROOT DRIVE PER SOCIETÀ
===================================================== */
const ROOTS = {
  MIS_OSIMO: "1bsPNJ2BFJIP9Q3WwDSVNy32u-Qu2qMjr",
  MIS_MONTEGIORGIO: "1PCvF76LJwD6T_OaPtkWg6dh1Tg-DG6or",
  MIS_GROTTAMMARE: "12Nj8o942uedxByJOtcSKXvkTBH6ShNNA"
};

/* =====================================================
   AUTH OAUTH
===================================================== */
function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("ENV mancanti per OAuth");
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "urn:ietf:wg:oauth:2.0:oob"
  );

  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return oAuth2Client;
}

/* =====================================================
   UTILS DRIVE
===================================================== */
async function getOrCreateFolder(drive, name, parentId) {
  const safeName = String(name).replace(/'/g, "\\'");
  const q = [
    `'${parentId}' in parents`,
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${safeName}'`,
    `trashed=false`
  ].join(" and ");

  const res = await drive.files.list({ q, fields: "files(id,name)" });
  if (res.data.files?.length) return res.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id"
  });

  return folder.data.id;
}

function meseFolder(data) {
  const mesi = [
    "01_GENNAIO","02_FEBBRAIO","03_MARZO","04_APRILE","05_MAGGIO","06_GIUGNO",
    "07_LUGLIO","08_AGOSTO","09_SETTEMBRE","10_OTTOBRE","11_NOVEMBRE","12_DICEMBRE"
  ];
  return mesi[new Date(data).getMonth()];
}

async function buildTree(drive, societa, modulo, data) {
  const rootId = ROOTS[societa];
  if (!rootId) throw new Error("Società non riconosciuta");

  const anno = new Date(data).getFullYear().toString();
  const mese = meseFolder(data);

  const annoId = await getOrCreateFolder(drive, anno, rootId);
  const modId = await getOrCreateFolder(drive, modulo, annoId);
  return await getOrCreateFolder(drive, mese, modId);
}

function toDriveViewLink(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}

function bufferFromBase64(b64, label = "file") {
  if (!b64) throw new Error(`${label} base64 mancante`);
  return Buffer.from(b64, "base64");
}

/* =====================================================
   HANDLER
===================================================== */
exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error("Body mancante");

    const {
      societa, modulo, tipo, data_servizio,
      deposito_drive, email, pdf, excel
    } = JSON.parse(event.body);

    if (!societa || !modulo || !tipo || !data_servizio) {
      throw new Error("Parametri obbligatori mancanti");
    }

    /* =====================================================
       DRIVE
    ===================================================== */
    let drive = null;
    if (deposito_drive === true) {
      drive = google.drive({ version: "v3", auth: getOAuthClient() });
    }

    let pdfLink = null;
    let excelLink = null;

    if (deposito_drive === true && drive) {
      const parentId = await buildTree(drive, societa, modulo, data_servizio);

      if (pdf) {
        const resPdf = await drive.files.create({
          requestBody: { name: pdf.name, parents: [parentId] },
          media: { mimeType: "application/pdf", body: Readable.from(bufferFromBase64(pdf.data)) },
          fields: "id"
        });
        pdfLink = toDriveViewLink(resPdf.data.id);
      }

      if (tipo === "TS" && excel) {
        const resXls = await drive.files.create({
          requestBody: { name: excel.name, parents: [parentId] },
          media: {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            body: Readable.from(bufferFromBase64(excel.data))
          },
          fields: "id"
        });
        excelLink = toDriveViewLink(resXls.data.id);
      }
    }

    /* =====================================================
       EMAIL SOLO PER CHECKLIST
    ===================================================== */
    if (tipo === "CHECKLIST") {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PWD
        }
      });

      const attachments = [];
      if (pdf) {
        attachments.push({
          filename: pdf.name,
          content: bufferFromBase64(pdf.data)
        });
      }

      let text =
        `Documento: ${modulo}\n` +
        `Società: ${societa}\n` +
        `Data: ${data_servizio}\n`;

      if (deposito_drive === true) {
        if (pdfLink) text += `\nPDF su Drive: ${pdfLink}`;
        if (excelLink) text += `\nExcel su Drive: ${excelLink}`;
      } else {
        text += `\nModalità TEST / SCUOLA (nessun deposito su Drive)`;
      }

      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email?.to || [],
        cc: email?.cc || [],
        subject: `${modulo} – ${societa}`,
        text,
        attachments
      });
    }

    /* =====================================================
       RISPOSTA OK
    ===================================================== */
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        definitivo: deposito_drive === true,
        pdfLink,
        excelLink
      })
    };

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
