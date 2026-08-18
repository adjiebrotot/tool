# QR Code Data Transfer — audit harness

Three passes, from the maths outward.

**Pass A** runs the wire protocol in node's `vm` against the exact shipped
`codec.js`, with no browser and no camera. It checks Base45 exhaustively over
every two-byte value, verifies the QR capacity arithmetic against the published
tables, checks CRC-32 known vectors, round-trips frames and rejects corrupted
ones, and streams the fountain code across K from 1 to 1000 at 0 to 50% frame
loss, asserting byte-for-byte reconstruction and a bounded overhead every time.

It also holds **golden index vectors**. The sender and receiver must derive
identical block index sets from the same symbol id, on different devices and
different JavaScript engines. If one of those vectors changes, the wire
behaviour changed and already-built senders stop interoperating, so a failure
there means the protocol version needs a bump, not a fixed test.

**Pass B** drives the real page in headless Chromium over `file://` with every
CDN stubbed. It checks the panes, the theme, the presets, the size limit, and
that frames minted in the browser parse in node. Most of it is about graceful
degradation: with no encoder reachable the sender must warn rather than throw.

**Pass C** (online only) builds a Y4M clip of a real broadcast and feeds it to
Chromium's fake camera, so the whole receiver pipeline runs for real: camera,
video, ROI crop, jsQR worker, fountain decoder, checksum, download. This is the
pass that caught the two bugs the codec tests could not see, an async
`applyConstraints` rejection and a capture crop that upscaled the frame and
destroyed the code.

**Pass D** (online only) destroys frames on purpose, through that same optical
path, and checks the two promises the tool makes.

- **R1** blanks the opening, blocks about 40% of the codes with an obstruction
  across the middle, and tears others in half across two different codes, so
  roughly half of everything on screen is unreadable. The transfer still has to
  finish and deliver a byte-identical file.
- **R2** blocks the plain copies of two specific blocks in every single pass, so
  those blocks are never once transmitted in the clear. The fountain repair
  frames have to rebuild them, which is the whole reason the code is rateless.
- **R3** is the inverse promise. Every code is clean and passes its own per-frame
  checksum, but the blocks carry the wrong bytes, which is what a miscorrected
  code looks like from the receiver's side. The whole-file checksum must catch
  it: no download is ever offered, the receiver says so plainly, and it keeps
  scanning rather than giving up.

```sh
node run.mjs                  # passes A and B, fully offline
QRT_ONLINE=1 node run.mjs     # adds real QR images and the fake camera
QRT_QUICK=1 node run.mjs      # trims the fountain sweep
QRT_FREEZE=1 node run.mjs     # prints golden vectors to paste back in
```

`QRT_ONLINE` fetches the two pinned libraries once into `_audit/.cache/`
(gitignored) and serves them into the page, because the headless browser has no
route to the internet. Repeat runs need no network.
