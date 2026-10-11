// test-galicia.ts
import "dotenv/config";
import fs from "node:fs";

// src/mastra/agents/bank-extractors/galicia.ts
import { Agent } from "@mastra/core/agent";

// src/mastra/agents/opencode-headers.ts
import { MASTRA_THREAD_ID_KEY } from "@mastra/core/request-context";
var opencodeGoHeaders = ({ requestContext }) => ({
  "x-opencode-session": String(requestContext.get(MASTRA_THREAD_ID_KEY) ?? "saldare-agent")
});

// src/mastra/agents/bank-extractors/galicia.ts
var bankExtractorGalicia = new Agent({
  id: "bank-extractor-galicia",
  name: "Bank Extractor - Banco Galicia",
  description: "Extrae los movimientos bancarios del markdown de un extracto del Banco Galicia procesado por LlamaCloud.",
  model: [
    {
      id: "extractor",
      model: "opencode-go/qwen3.8-max",
      headers: opencodeGoHeaders
    }
  ],
  instructions: `
Act\xFAa como un analista de datos financieros. Tu tarea es procesar el texto en formato Markdown adjunto, correspondiente a un extracto de Cuenta Corriente del Banco Galicia, y extraer exclusivamente el detalle de los movimientos diarios.

Instrucciones de Extracci\xF3n

Identificar la Tabla de Movimientos: Localiza en el texto la secci\xF3n donde se listan las transacciones diarias. Ignora el encabezado con los datos de la cuenta (CBU, titular, CUIT, per\xEDodo), el cuadro de "Saldos y Totales" y el "Consolidado de Retenci\xF3n de Impuestos".

Columnas a Extraer: Para cada transacci\xF3n, debes capturar los siguientes campos exactos:

Fecha: Fecha de la operaci\xF3n (formato DD/MM/AAAA).

Concepto: Descripci\xF3n del movimiento (ej. "Transf. a terceros", "S.I.R.C.R.E.B.", "Impuesto Ley 25.413"). Si la descripci\xF3n ocupa varias l\xEDneas en el Markdown, unif\xEDcala en una sola cadena de texto.

Referencia/Sucursal: N\xFAmero de comprobante o sucursal asociado. Si la fila no contiene este dato, asigna el valor null.

D\xE9bito: Monto de salida de dinero.

Cr\xE9dito: Monto de entrada de dinero.

Saldo: Saldo de la cuenta tras la operaci\xF3n.

Reglas de Limpieza y Normalizaci\xF3n:

Elimina cualquier s\xEDmbolo de moneda (como $).

Convierte todos los valores monetarios a formato num\xE9rico internacional: elimina los puntos separadores de miles y utiliza exclusivamente el punto (.) como separador decimal (ejemplo: convierte 1.234,56 a 1234.56).

Si una fila tiene un valor en "D\xE9bito", el "Cr\xE9dito" debe ser 0, y viceversa.

Formato de Salida:

Devuelve los datos \xFAnicamente en formato JSON v\xE1lido, estructurado como un array de objetos.

No incluyas texto adicional, introducciones ni conclusiones fuera del bloque JSON.
  `
});

// src/mastra/agents/bank-extractors/types.ts
import { z } from "zod";
var movimientoRowSchema = z.object({
  cuenta: z.string().describe('N\xFAmero de cuenta (NRO) al que pertenece el movimiento, p. ej. "3-320-0941456600-5".'),
  fecha: z.string().describe('Fecha del movimiento, p. ej. "03/01/23".'),
  descripcion: z.string().describe("Descripci\xF3n del movimiento."),
  referencia: z.string().describe("Referencia. Puede estar vac\xEDa."),
  debitos: z.string().describe("Importe d\xE9bito tal como figura en el extracto. Puede estar vac\xEDo."),
  creditos: z.string().describe("Importe cr\xE9dito tal como figura en el extracto. Puede estar vac\xEDo."),
  saldo: z.string().describe("Saldo tal como figura en el extracto, sin recalcular.")
});
var extractorOutputSchema = z.object({
  movimientos: z.array(movimientoRowSchema).describe("Todos los movimientos de todas las tablas extra\xEDdas, consolidados en un solo arreglo.")
});

// test-galicia.ts
import LlamaCloud from "@llamaindex/llama-cloud";
var apiKey = process.env.LLAMA_CLOUD_API_KEY;
var client = new LlamaCloud({ apiKey });
var path = process.argv[2] ?? "src/mastra/public/workspace/galicia-1.pdf";
var fileObj = await client.files.create({
  file: fs.createReadStream(path),
  purpose: "parse"
});
console.log("uploaded fileId=", fileObj.id);
var result = await client.parsing.parse({
  file_id: fileObj.id,
  tier: "cost_effective",
  version: "latest",
  expand: ["markdown_full", "text_full"]
});
var markdown = result.markdown_full ?? "";
console.log("markdown length=", markdown.length);
fs.writeFileSync("/tmp/galicia-markdown.md", markdown);
var prompt = `Extrae los movimientos bancarios del siguiente markdown:

${markdown}`;
console.log("--- agent raw generate (no schema) ---");
try {
  const res = await bankExtractorGalicia.generate(prompt);
  console.log("finishReason=", res.finishReason);
  console.log("text=", String(res.text).slice(0, 1500));
} catch (e) {
  console.error("ERROR raw:", e);
}
console.log("--- structured output attempt ---");
try {
  const res = await bankExtractorGalicia.generate(prompt, {
    structuredOutput: { schema: extractorOutputSchema }
  });
  console.log("finishReason=", res.finishReason);
  console.log("object=", JSON.stringify(res.object)?.slice(0, 1500));
  console.log("text=", String(res.text).slice(0, 800));
} catch (e) {
  console.error("ERROR structured:", e);
}
