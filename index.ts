import child from "child_process";
import { G4F } from "g4f";
import {
  CanvasRenderingContext2D,
  Canvas,
  loadImage,
  FontLibrary,
} from "skia-canvas";
import { cover } from "./fit";
import { blendColors, rgbToHex } from "./colors";

const [imageFile] = process.argv.slice(2);

const PROMPT = `
    Instruções:
    - Traduza o texto da Thumbnail para Português, retornando apenas a tradução, de forma a ter uma quantidade de caracteres semelhante ao original.
    - Margem de alteração de caracteres de 20% para mais ou para menos.
    - Se algum pedaço parecer ser um nome, pais, cidade, ou algo que não faça sentido traduzir, mantenha o texto original.
    - Apenas retorne palavras validas em português mesmo que o input esteja com alguns caracteres errados.
    - Se o texto anterior(ou seguinte) for relevante para a tradução, considere-o. Ex: ["Time", "Travel"] -> ["Viagem", "no tempo"], ["  "] -> ["Revendedor", "de tempo"]

    Contexto de tradução:
    - Texto de Thumbnail de Animes/Mawha ou mangas.
    - Em geral são textos de níveis, nomes de personagens, habilidades, etc.
    - Em geral a thumb tem 2 lados, esquerdo com o personagem, desprezado, perdido ou mal, e na direita o personagem com poder, vitorioso, ou bem.

    Exemplos de tradução ("input": "output"):
    - "Level 1": "Nível 1"
    - "God Mode": "Modo Deus"
    - "Demon God": "Deus Demônio"
    - "Before": "Antes"
    - "After": "Depois"
    - "LVL 1": "LVL 1"
    - "LVL 999": "LVL 999"
    - "<DEX>": "<DEX>"

    Textos comuns:
    - "chapters": "capítulos"
    - "level": "nível"
    - "prodigy": "prodígio"
    - "power": "poder"
    - "god": "deus"
    - "time": "tempo"
    - "dealer": "negociante"
    - "boss": "chefão"
    - "hope": "esperança"

    Texto anterior(para contexto):
    {lastText}

    Texto seguinte(para contexto):
    {nextText}

    Texto para traduzir:
    {text}
`;

type Item = {
  bbox: number[][];
  text: string;
  prob: number;
  color: number[];
};

async function translate(text: string, lastText: string, nextText: string) {
  const g4f = new G4F();

  const response = await g4f.chatCompletion(
    [
      {
        role: "user",
        content: PROMPT.replace("{text}", text)
          .replace("{lastText}", lastText)
          .replace("{nextText}", nextText),
      },
    ],
    {
      model: "gpt-4",
    }
  );

  return response as string;
}

const canvas = new Canvas(1280, 720);
const ctx = canvas.getContext("2d");

async function main() {
  const response = child.spawnSync("./index.py " + imageFile, {
    shell: true,
  });

  const json: Item[] = JSON.parse(response.stdout.toString()).filter(
    (item: Item) => {
      const isNumber = !isNaN(Number(item.text));

      if (isNumber || item.text.length < 4) {
        return false;
      }

      return true;
    }
  );

  await createCanva();

  let i = 0;

  for (const item of json) {
    const isYellow = [252, 223, 0].every((v, i) => v === item.color[i]);

    item.text = await translate(
      item.text,
      i > 0 ? json[i - 1].text : "",
      i < json.length - 1 ? json[i + 1].text : ""
    );

    const x = item.bbox[0][0];
    const y = item.bbox[0][1];
    const width = item.bbox[1][0] - x;
    const height = item.bbox[2][1] - y;

    const nCaracters = item.text.length;

    applyBlur(ctx, x, y, width, height, 10);
    drawText(
      ctx,
      item.text,
      x + (width * 0.05 * 4) / nCaracters,
      y - height * 0.2,
      height * 1.2,
      rgbToHex(item.color),
      isYellow ? "black" : blendColors(rgbToHex(item.color), "#000000", 0.8)
    );

    i++;
  }

  await canvas.saveAs("output.png");
}

async function createCanva() {
  canvas.width = 1280;
  canvas.height = 720;

  const ctx = canvas.getContext("2d");

  FontLibrary.use("zumme", ["Zuume-Bold.woff"]);

  const image = await loadImage(imageFile);

  const imageWidth = image.width;
  const imageHeight = image.height;

  const parentWidth = canvas.width;
  const parentHeight = canvas.height;

  const { offsetX, offsetY, width, height } = cover(
    parentWidth,
    parentHeight,
    imageWidth,
    imageHeight
  );

  ctx.drawImage(image as any, offsetX, offsetY, width, height);

  //   ctx.font = "bold 150px zumme";
  //   ctx.shadowColor = "black";
  //   ctx.shadowBlur = 0;
  //   ctx.lineWidth = 20;
  //   ctx.strokeText("Level 1", 110, 650);

  //   ctx.strokeText("Level 1", 100, 640);

  //   ctx.shadowBlur = 0;
  //   ctx.fillStyle = "yellow";
  //   ctx.fillText("Level 1", 100, 640);

  // applyBlur(ctx, 100, 540, 420, 150, 10);
  // drawText(ctx, "Level 1", 100, 640, 200, "yellow", "black");
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 100,
  color = "yellow",
  shadowColor = "black"
) {
  ctx.textBaseline = "top";
  ctx.font = `bold ${size}px zumme`;
  ctx.strokeStyle = shadowColor;
  ctx.shadowBlur = 0;
  ctx.lineWidth = (12 * size) / 100;
  ctx.strokeText(text, x + 10, y + 10);

  ctx.strokeText(text, x, y);

  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function applyBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  blurAmount: number
) {
  const tempCanvas = new Canvas(width, height);
  const tempCtx = tempCanvas.getContext("2d");

  tempCanvas.width = width;
  tempCanvas.height = height;

  tempCtx.drawImage(
    ctx.canvas as any,
    x,
    y,
    width,
    height,
    0,
    0,
    width,
    height
  );

  tempCtx.filter = `blur(${blurAmount}px)`;
  tempCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width, height);
  tempCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width, height);
  tempCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width, height);
  tempCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width, height);

  ctx.drawImage(tempCanvas, 0, 0, width, height, x, y, width, height);
}

main();
