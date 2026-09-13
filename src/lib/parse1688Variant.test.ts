import { describe, expect, it } from "vitest";
import { find1688VariantColumns, parse1688VariantText } from "./parse1688Variant";

describe("parse1688VariantText", () => {
  it("separa modelo, color compuesto y talla desde el formato 1688", () => {
    expect(parse1688VariantText("Q05 white beige，39")).toMatchObject({
      productName: "Q05",
      color: "white beige",
      size: "39",
      raw: "Q05 white beige，39",
    });
  });

  it("conserva colores compuestos y tallas decimales", () => {
    expect(parse1688VariantText("Q05 white beige (upgrade increased),39.5")).toMatchObject({
      productName: "Q05",
      color: "white beige (upgrade increased)",
      size: "39.5",
    });
  });

  it("soporta tallas alfanuméricas y no confunde el código de modelo", () => {
    expect(parse1688VariantText("ABC05 navy blue XL")).toMatchObject({
      productName: "ABC05",
      color: "navy blue",
      size: "XL",
    });
  });

  it("trata una variante sin código de modelo como color y talla", () => {
    expect(parse1688VariantText("Black, S")).toMatchObject({
      productName: "",
      color: "Black",
      size: "S",
    });
  });

  it("deja la talla vacía cuando no hay una talla identificable", () => {
    expect(parse1688VariantText("Q05 khaki special edition")).toMatchObject({
      productName: "Q05",
      color: "khaki special edition",
      size: "",
    });
  });
});

describe("find1688VariantColumns", () => {
  it("detecta nombres explícitos sin exigir que existan", () => {
    expect(find1688VariantColumns(["Nombre del SKU", "Variante_1_color", "Variante_2_Talla"])).toEqual({
      color: "Variante_1_color",
      size: "Variante_2_Talla",
    });

    expect(find1688VariantColumns(["Nombre del SKU", "Inventario"])).toEqual({
      color: "",
      size: "",
    });
  });
});
