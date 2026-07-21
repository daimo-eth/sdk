import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import type { NavNodeChooseOption } from "../api/navTree.js";

import { ChooseOptionPage } from "./ChooseOptionPage.js";

test("connected wallet uses the session action verb inside a group", () => {
  const node: NavNodeChooseOption = {
    type: "ChooseOption",
    id: "OtherMethods",
    title: "Other",
    options: [
      {
        type: "ConnectedWallet",
        id: "ConnectedWallet",
        title: "Connected Wallet",
      },
    ],
  };

  const html = renderToStaticMarkup(
    createElement(ChooseOptionPage, {
      node,
      connectedAddress: "0xE2670000000000000000000000000000000070E9",
      actionVerb: "Deposit",
      onNavigate: () => {},
      onBack: () => {},
      baseUrl: "",
    }),
  );

  expect(html).toContain("Deposit with 0xE267...70E9");
  expect(html).not.toContain("Other with 0xE267...70E9");
});
