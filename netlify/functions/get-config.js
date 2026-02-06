// /.netlify/functions/get-config.js

exports.handler = async (event) => {

  /* =====================================================
     1️⃣ LETTURA CODICE SOCIETÀ
  ====================================================== */
  const societa = event.queryStringParameters?.societa;

  if (!societa) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "societa mancante" })
    };
  }

  /* =====================================================
     2️⃣ DATABASE (MOCK → DOMANI DB / JSON / FIREBASE)
  ====================================================== */
  const DB = {

    MIS_OSIMO: {
      ente: {
        nome: "Misericordia",
        via: "Piazza Santa Maria",
        civico: "5",
        citta: "Osimo (AN)",
        tel: "3331234151"
      },
      mail: {
        to: "msautec@gmail.com.it",
        pwd: ""               // ⚠️ vuota sul server
      }
    },

    MIS_MONTEGIORGIO: {
      ente: {
        nome: "Misericordia",
        via: "Via Giotto",
        civico: "1",
        citta: "Montegiorgio (FM)",
        tel: "0734961931"
      },
      mail: {
        to: "marco.pieragostini@gmail.com",
        pwd: ""
      }
    } ,

MIS_GROTTAMMARE: {
      ente: {
        nome: "Misericordia",
        via: "Via Fratelli Rosselli",
        civico: "35A",
        citta: "Grottammare (AP)",
        tel: "0735632437"
      },
      mail: {
        to: "riv@pallottiniantincendi.it",
        pwd: ""
      }
    }

  };

  /* =====================================================
     3️⃣ RECUPERO CONFIGURAZIONE
  ====================================================== */
  const cfg = DB[societa];

  if (!cfg) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "societa non trovata" })
    };
  }

  /* =====================================================
     4️⃣ RISPOSTA OK (NO CACHE)
  ====================================================== */
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(cfg)
  };
};
