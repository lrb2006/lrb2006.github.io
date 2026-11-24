# Lianna Li · Compounding Curiosity

My personal portfolio, published at **https://lrb2006.github.io/**.

A financial particle introduction assembles into LIANNA, responds to pointer movement, and reveals a collection of project drawers through a water-ripple transition. A record player plays my original music demo.

## Explore

- Commerce Ops: an illustrative payment-reconciliation example, plus project details and code.
- Quant Research Engine: historical cost-sensitivity results at four trading-cost assumptions.
- Market-Making Simulator: an illustrative inventory-skew quotation calculator.
- ISRG Valuation: an illustrative terminal-value sensitivity calculator.

Decorative market motion is not live financial data. Project details distinguish historical research, simulations, and invented interaction examples.

## Run locally

This is a buildless static site. From the repository root:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://localhost:8765 in Chrome. No build step is needed.

## Optional hand control

Select **Try hand control** on the entrance screen, allow camera access, separate your thumb and index finger, and then pinch to enter. The page loads MediaPipe Tasks Vision 0.10.21, its WASM runtime, and the Google-hosted Hand Landmarker model on demand. An internet connection and a supported secure browser context are required.

The page processes camera frames on the device; it does not record or upload video. It releases the camera when entering, cancelling, hiding the tab, or leaving the page. Mouse, touch, keyboard, and skip controls remain available without hand tracking.

System reduced-motion preferences suppress continuous animation. Interface sounds are optional; music starts only after selecting Play.

## Verification

JavaScript syntax, local asset references, DOM interaction checks, sample calculations, pinch-gate logic, and rejected/late camera-permission cleanup were checked during development. These checks use media/canvas stubs and do not establish real-camera detection quality or replace browser visual and playback testing.

See [ASSETS.md](ASSETS.md) for asset sources and licenses.
