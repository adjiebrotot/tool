/* home-anim.js: the small looping drawing at the left of each tool card on the home page.
 *
 * The page marks a panel with <div class="tool-anim" data-anim="KEY" aria-hidden="true"></div>;
 * this script fills it with an inline <svg viewBox="0 0 120 120"> drawn for that key.
 * A key with no drawing leaves the panel empty.
 *
 * Adding a tool: one entry in ART (the SVG markup inside the <svg>) and one block in CSS.
 * In a CSS block "&" stands for ".ta-KEY " (descendant), so every rule stays scoped to its drawing;
 * "&{--d:6s}" sets the single loop length every element of that drawing shares.
 * Rules: CSS keyframes on transform / opacity only (so the browser can run them off the main thread),
 * choreography by keyframe percentages or negative delays only, page colour tokens only,
 * and the un-animated markup must be the drawing's best still frame (reduced motion shows it).
 * Full brief: .claude/agents/tool-animator.md
 */
(function () {
  'use strict';

  // Shared look for the family. Paint: .w white outlined blue; .t the thin 2.5 stroke; s* stroke, f* fill:
  // b accent, B accent-strong, m accent2 (mint), g gold, q border-strong, w panel, r accent3 (red: brand marks only).
  // Pivots (fill-box): .oc centre, .ob bottom centre, .ol left middle, .ot top centre.
  var BASE =
    '.tool-anim svg{display:block;width:100%;height:100%;overflow:visible}' +
    '.ta *{animation-duration:var(--d);animation-timing-function:ease-in-out;animation-iteration-count:infinite}' +
    '.ta .w{fill:var(--panel);stroke:var(--accent)}.ta .t{stroke-width:2.5px}' +
    '.ta .sb{stroke:var(--accent)}.ta .sB{stroke:var(--accent-strong)}.ta .sm{stroke:var(--accent2)}' +
    '.ta .sg{stroke:var(--gold)}.ta .sq{stroke:var(--border-strong)}.ta .sw{stroke:var(--panel)}' +
    '.ta .fb{fill:var(--accent)}.ta .fB{fill:var(--accent-strong)}.ta .fm{fill:var(--accent2)}' +
    '.ta .fg{fill:var(--gold)}.ta .fw{fill:var(--panel)}.ta .fr{fill:var(--accent3)}' +
    ".ta text{stroke:none;font-family:'DM Sans',system-ui,sans-serif;font-weight:800;text-anchor:middle}" +
    ".ta .mono{font-family:'DM Mono',ui-monospace,monospace;font-weight:500}" +
    '.ta .oc,.ta .ob,.ta .ol,.ta .ot{transform-box:fill-box;transform-origin:50% 50%}' +
    '.ta .ob{transform-origin:50% 100%}.ta .ol{transform-origin:0 50%}.ta .ot{transform-origin:50% 0}' +
    '.tool-anim:not(.is-playing) *{animation-play-state:paused!important}' +
    '@media (prefers-reduced-motion:reduce){.ta *{animation:none!important}}';

  var ART = {
    // One band splits in two, then three, drawing in left to right.
    sankeycreator:
      '<g class="s1 ol" fill-opacity=".45"><path class="fb" d="M18 40C37 40 37 26 56 26V54C37 54 37 68 18 68Z"/>' +
        '<path class="fm" d="M18 68C37 68 37 74 56 74V94C37 94 37 88 18 88Z"/>' +
        '<rect class="fb" x="56" y="26" width="6" height="28" rx="2" fill-opacity="1"/>' +
        '<rect class="fm" x="56" y="74" width="6" height="20" rx="2" fill-opacity="1"/></g>' +
      '<g class="s2 ol" fill-opacity=".45"><path class="fb" d="M62 26C81 26 81 18 100 18V34C81 34 81 42 62 42Z"/>' +
        '<path class="fg" d="M62 42C81 42 81 52 100 52V64C81 64 81 54 62 54Z"/>' +
        '<path class="fg" d="M62 74C81 74 81 64 100 64V72C81 72 81 82 62 82Z"/>' +
        '<path class="fm" d="M62 82C81 82 81 88 100 88V100C81 100 81 94 62 94Z"/>' +
        '<g fill-opacity="1"><rect class="fb" x="100" y="18" width="6" height="16" rx="2"/>' +
        '<rect class="fg" x="100" y="52" width="6" height="20" rx="2"/>' +
        '<rect class="fm" x="100" y="88" width="6" height="12" rx="2"/></g></g>' +
      '<rect class="fB" x="12" y="40" width="6" height="48" rx="2"/>',

    // Five bars bouncing out of phase.
    graphvisualiser:
      '<rect class="b ob fb" x="26" y="61" width="11" height="36" rx="2.5"/>' +
      '<rect class="b ob fm" x="42" y="41" width="11" height="56" rx="2.5" style="animation-delay:-1.6s"/>' +
      '<rect class="b ob fb" x="58" y="69" width="11" height="28" rx="2.5" style="animation-delay:-.8s"/>' +
      '<rect class="b ob fg" x="74" y="33" width="11" height="64" rx="2.5" style="animation-delay:-2.6s"/>' +
      '<rect class="b ob fb" x="90" y="51" width="11" height="46" rx="2.5" style="animation-delay:-3.3s"/>' +
      '<path class="sq" d="M18 22V98H106"/>',

    // A business model canvas; sticky notes pop into the cells, then clear.
    canvasbuilder:
      '<rect class="w" x="12" y="22" width="96" height="76" rx="4"/>' +
      '<path class="sq t" d="M31 23V76M50 23V76M70 23V76M89 23V76M13 76H107M31 49H50M70 49H89M60 76V97"/>' +
      '<rect class="nt oc fg" x="15.5" y="43" width="12" height="12" rx="2"/>' +
      '<rect class="nt oc fm" x="34.5" y="29.5" width="12" height="12" rx="2" style="animation-delay:-6.6s"/>' +
      '<rect class="nt oc fb" x="54" y="43" width="12" height="12" rx="2" style="animation-delay:-6.2s"/>' +
      '<rect class="nt oc fg" x="73.5" y="56.5" width="12" height="12" rx="2" style="animation-delay:-5.8s"/>' +
      '<rect class="nt oc fm" x="92.5" y="43" width="12" height="12" rx="2" style="animation-delay:-5.4s"/>' +
      '<rect class="nt oc fb" x="78" y="81" width="12" height="12" rx="2" style="animation-delay:-5s"/>',

    // A prize wheel spins, eases out and lands; colours repeat every 180deg so the loop is seamless.
    randompicker:
      '<g class="wh oc"><path class="fb sw" d="M60 66L43 36.6A34 34 0 0 1 77 36.6Z"/>' +
        '<path class="fm sw" d="M60 66L77 36.6A34 34 0 0 1 94 66Z"/>' +
        '<path class="fg sw" d="M60 66L94 66A34 34 0 0 1 77 95.4Z"/>' +
        '<path class="fb sw" d="M60 66L77 95.4A34 34 0 0 1 43 95.4Z"/>' +
        '<path class="fm sw" d="M60 66L43 95.4A34 34 0 0 1 26 66Z"/>' +
        '<path class="fg sw" d="M60 66L26 66A34 34 0 0 1 43 36.6Z"/>' +
        '<circle class="sb" cx="60" cy="66" r="34" stroke-width="3.5"/></g>' +
      '<circle class="w" cx="60" cy="66" r="5.5"/><path class="pt ot fB sB" d="M52 20H68L60 35Z"/>',

    // A seesaw with a house on one side and an apartment block on the other.
    rentvsownhouse:
      '<path class="sq" d="M34 100H86"/><path class="w" d="M60 80L50 98H70Z"/><g class="bm">' +
        '<rect class="w" x="19" y="56" width="28" height="20" rx="2"/>' +
        '<path class="fm sm" d="M15 57L33 40L51 57Z"/>' +
        '<rect class="fb" x="24" y="64" width="7" height="12" rx="1.5"/>' +
        '<rect class="sb t" x="36" y="61" width="6" height="6" rx="1"/>' +
        '<rect class="w" x="76" y="32" width="25" height="44" rx="2"/>' +
        '<path class="sm" stroke-width="5" stroke-linecap="butt" d="M80 41h6m5 0h6M80 51h6m5 0h6M80 61h6"/>' +
        '<rect class="fb" x="91" y="64" width="6" height="12" rx="1.5"/>' +
        '<path class="sB" stroke-width="3.5" d="M14 78H106"/></g>',

    // A turning globe; $, $$ and $$$ tags pop up at different spots in turn.
    'costofliving-comparator':
      '<circle class="w" cx="60" cy="64" r="34"/>' +
      '<path class="sb t" stroke-opacity=".35" d="M27 64H93M32 47Q60 52 88 47M32 81Q60 86 88 81"/>' +
      '<g class="sb" stroke-width="2" stroke-opacity=".6"><path class="mr ol" d="M60 30A17 34 0 0 1 60 98"/>' +
      '<path class="mr m2 ol" d="M60 30A17 34 0 0 1 60 98" style="animation-delay:-2s"/>' +
      '<path class="mr m3 ol" d="M60 30A17 34 0 0 1 60 98" style="animation-delay:-4s"/></g>' +
      '<g class="tg ob"><circle class="fg" cx="40" cy="51" r="3"/><rect class="fg" x="31" y="29" width="18" height="14" rx="4"/>' +
        '<path class="fg" d="M36.5 42L40 47L43.5 42Z"/><text class="fw" x="40" y="40" font-size="11">$</text></g>' +
      '<g class="tg ob" style="animation-delay:-4s"><circle class="fg" cx="84" cy="66" r="3"/><rect class="fg" x="72" y="44" width="24" height="14" rx="4"/>' +
        '<path class="fg" d="M80.5 57L84 62L87.5 57Z"/><text class="fw" x="84" y="55" font-size="11">$$</text></g>' +
      '<g class="tg ob" style="animation-delay:-2s"><circle class="fg" cx="54" cy="91" r="3"/><rect class="fg" x="39" y="69" width="30" height="14" rx="4"/>' +
        '<path class="fg" d="M50.5 82L54 87L57.5 82Z"/><text class="fw" x="54" y="80" font-size="11">$$$</text></g>',

    // A globe with three clocks around it, each at its own time.
    worldclock:
      '<circle class="w" cx="60" cy="62" r="26"/>' +
      '<path class="sb t" stroke-opacity=".4" d="M35 62H85M60 37C47 45 47 79 60 87C73 79 73 45 60 37"/>' +
      '<circle class="w" cx="27" cy="32" r="13"/><circle class="fw sm" cx="94" cy="47" r="13"/>' +
      '<circle class="fw sg" cx="36" cy="94" r="13"/>' +
      '<path class="sB t" d="M27 32L21.8 29M94 47L99.2 44M36 94L33 99.2"/><path class="mh ob sB t" d="M27 32V23"/>' +
      '<path class="mh ob sB t" d="M94 47V38" style="animation-delay:-2s"/>' +
      '<path class="mh ob sB t" d="M36 94V85" style="animation-delay:-5s"/>' +
      '<path class="fB" d="M27 30a2 2 0 1 0 .1 0ZM94 45a2 2 0 1 0 .1 0ZM36 92a2 2 0 1 0 .1 0Z"/>',

    // A friendly mitten reaches down, grabs a banknote and pulls it back up.
    borrowingcapacity:
      '<rect class="fm" x="34" y="72" width="60" height="26" rx="4" fill-opacity=".3"/>' +
      '<g class="nt"><rect class="fw sm" x="30" y="78" width="60" height="26" rx="4"/>' +
        '<circle class="sm t" cx="60" cy="91" r="7"/><text class="fm" x="60" y="95" font-size="11">$</text></g>' +
      '<rect class="sl ot fb" x="51" y="6" width="18" height="26" rx="2"/><g class="hd">' +
        '<path class="op w" d="M50 34V44L43 51A3.5 3.5 0 0 0 48 56L50 54V58A10 10 0 0 0 70 58V34Z"/>' +
        '<g class="fs" opacity="0"><rect class="w" x="48" y="36" width="24" height="26" rx="9"/>' +
          '<path class="sb t" d="M55 56v5M60 56v5M65 56v5"/></g>' +
        '<rect class="fm" x="47" y="28" width="26" height="8" rx="3"/></g>',

    // A Markdown page writes itself line by line, then a PDF stamp lands on its corner.
    mdtopdf:
      '<path class="w" d="M30 14H74L90 30V104H30Z"/><path class="sb t" d="M74 14V30H90"/>' +
      '<path class="sm t" d="M39 31L37 43M45 31L43 43M35 35H47M34 39.5H46"/>' +
      '<path class="ln ol sB" stroke-width="4" d="M50 37H70"/>' +
      '<path class="ln ol sq" d="M38 54H80" style="animation-delay:-5.64s"/>' +
      '<path class="ln ol sq" d="M38 64H74" style="animation-delay:-5.28s"/>' +
      '<path class="ln ol sq" d="M38 74H80" style="animation-delay:-4.92s"/>' +
      '<path class="ln ol sq" d="M38 84H64" style="animation-delay:-4.56s"/>' +
      '<path class="ln ol sq" d="M38 94H56" style="animation-delay:-4.2s"/>' +
      '<g transform="rotate(-10 86 92)"><g class="st oc">' +
        '<rect class="fg sw t" x="69" y="83" width="34" height="18" rx="4"/>' +
        '<text class="fw" x="86" y="96" font-size="11">PDF</text></g></g>',

    // A code window: a prompt, script lines typing in, then the PowerFactory badge stamps on its corner
    // and its red corner slides home.
    'powerfactory-scripter':
      '<rect class="w" x="14" y="20" width="92" height="80" rx="6"/><path class="sb t" d="M15 33H105"/>' +
      '<path class="sg" stroke-width="4.5" d="M22 26.5h0"/><path class="sm" stroke-width="4.5" d="M29 26.5h0"/><path class="sb" stroke-width="4.5" d="M36 26.5h0"/>' +
      '<path class="sm t" d="M23 44L28 47.5L23 51"/>' +
      '<rect class="cu fm" x="31" y="49" width="7" height="2.5" rx="1"/><path class="ln ol sb" d="M24 61H62"/>' +
      '<path class="ln ol sm" d="M32 71H68" style="animation-delay:-4.55s"/>' +
      '<path class="ln ol sb" d="M32 81H56" style="animation-delay:-4.1s"/>' +
      '<path class="ln ol sq" d="M24 91H46" style="animation-delay:-3.65s"/>' +
      '<g transform="rotate(-8 92 86)"><g class="bt oc">' +
        '<rect class="fB" x="76" y="70" width="32" height="32" rx="3"/>' +
        '<text class="fw" x="91" y="91.5" font-size="19" letter-spacing="-.6">PF</text>' +
        '<path class="fw" d="M108 82V99A3 3 0 0 1 105 102H88Z"/>' +
        '<path class="rc fr" d="M108 87V99A3 3 0 0 1 105 102H93Z"/></g></g>',

    // Two circles drift apart (separate) and slide into overlap (joint); a heart when joined.
    pisahvsgabung:
      '<g class="cl"><circle class="fb sb" cx="46" cy="58" r="24" fill-opacity=".14"/>' +
        '<circle class="sb t" cx="38" cy="51" r="4.5"/><path class="sb t" d="M30 67a8 8 0 0 1 16 0"/></g>' +
      '<g class="cr"><circle class="fm sm" cx="74" cy="58" r="24" fill-opacity=".14"/>' +
        '<circle class="sm t" cx="82" cy="51" r="4.5"/><path class="sm t" d="M74 67a8 8 0 0 1 16 0"/></g>' +
      '<path class="ht oc fg sg" stroke-width="2" d="M60 68L53.5 61.5A4 4 0 0 1 60 56A4 4 0 0 1 66.5 61.5Z"/>',

    // A seesaw with a payment card on one side and a cash stack on the other.
    financingvscash:
      '<path class="sq" d="M34 100H86"/><path class="w" d="M60 80L50 98H70Z"/><g class="bm">' +
        '<rect class="w" x="18" y="56" width="32" height="20" rx="3"/>' +
        '<rect class="fg" x="23" y="61" width="8" height="6" rx="1.5"/>' +
        '<path class="sb t" stroke-opacity=".5" d="M23 71H44"/>' +
        '<rect class="fw sm" x="73" y="53" width="30" height="18" rx="3"/>' +
        '<rect class="fw sm" x="70" y="58" width="30" height="18" rx="3"/>' +
        '<circle class="sm t" cx="85" cy="67" r="4.5"/><path class="sB" stroke-width="3.5" d="M14 78H106"/></g>',

    // Coins drop on a steady beat onto stacks that grow like a staircase, over a faint price line.
    dcasimulator:
      '<path class="sb t" stroke-opacity=".3" d="M12 50C24 38 32 38 42 48S60 58 70 44S92 32 108 38"/>' +
      '<path class="sg" stroke-width="5.5" stroke-opacity=".6" d="M21 94.5H33M43 94.5H55M43 87H55M65 94.5H77M65 87H77M65 79.5H77M87 94.5H99M87 87H99M87 79.5H99M87 72H99"/>' +
      '<path class="cn sg" stroke-width="5.5" d="M21 87H33"/>' +
      '<path class="cn sg" stroke-width="5.5" d="M43 79.5H55" style="animation-delay:-5.4s"/>' +
      '<path class="cn sg" stroke-width="5.5" d="M65 72H77" style="animation-delay:-4.8s"/>' +
      '<path class="cn sg" stroke-width="5.5" d="M87 64.5H99" style="animation-delay:-4.2s"/>' +
      '<path class="sq" d="M12 99.5H108"/>',

    // A growth line climbs the hill to a flag, which waves when reached.
    financialfreedom:
      '<path class="fm" fill-opacity=".16" d="M10 100C30 100 44 84 58 66C70 50 78 38 90 38C100 38 106 46 110 52V100Z"/>' +
      '<path class="sq" d="M10 100H110"/>' +
      '<g class="sb" stroke-width="3.5">' +
        '<path class="gs" d="M18 94L30 88" style="animation-delay:-5.76s"/><path class="gs" d="M30 88H38" style="animation-delay:-5.52s"/>' +
        '<path class="gs" d="M38 88L50 78" style="animation-delay:-5.28s"/><path class="gs" d="M50 78L58 76" style="animation-delay:-5.04s"/>' +
        '<path class="gs" d="M58 76L68 62" style="animation-delay:-4.8s"/><path class="gs" d="M68 62L76 58" style="animation-delay:-4.56s"/>' +
        '<path class="gs" d="M76 58L88 40" style="animation-delay:-4.32s"/></g>' +
      '<g class="fl ob"><path class="sB" d="M90 39V16"/><path class="cl ol fg sg t" d="M91 17L106 22L91 28Z"/></g>',

    // A JSON tree: { } root, children expand level by level, then fold back.
    jsonvisualiser:
      '<g class="l3 ot"><path class="sb t" d="M34 72V80M22 80H46M22 80V88M46 80V88"/>' +
        '<rect class="fm" x="15" y="88" width="14" height="10" rx="3"/><rect class="fg" x="39" y="88" width="14" height="10" rx="3"/></g>' +
      '<g class="l3 ot"><path class="sb t" d="M86 72V80M74 80H98M74 80V88M98 80V88"/>' +
        '<rect class="fb" x="67" y="88" width="14" height="10" rx="3"/><rect class="fm" x="91" y="88" width="14" height="10" rx="3"/></g>' +
      '<g class="l2 ot"><path class="sb t" d="M60 42V50M34 50H86M34 50V60M86 50V60"/>' +
        '<rect class="w" x="23" y="60" width="22" height="12" rx="4"/><rect class="w" x="75" y="60" width="22" height="12" rx="4"/></g>' +
      '<g class="rt oc"><rect class="w" x="43" y="24" width="34" height="18" rx="6"/>' +
        '<text class="mono fB" x="60" y="37" font-size="12">{ }</text></g>',

    // A film strip advances frame by frame; a GIF badge pulses when a frame is caught.
    videotogif:
      '<clipPath id="ta-vg-clip"><rect x="12" y="36" width="96" height="44" rx="4"/></clipPath>' +
      '<rect class="fb" x="12" y="36" width="96" height="44" rx="4"/><g clip-path="url(#ta-vg-clip)"><g class="fs">' +
        '<path class="sw" stroke-width="3.5" stroke-linecap="butt" stroke-dasharray="3.5 3.5" d="M-16 41.5H190M-16 74.5H190"/>' +
        '<path class="sw" stroke-width="22" stroke-linecap="butt" stroke-dasharray="22 6" d="M-16 58H190"/>' +
        '<path class="sm" stroke-width="5" stroke-dasharray="10 18" d="M-11 64.5H190"/>' +
        '<path class="sg" stroke-width="5" stroke-dasharray="0 28" d="M0 52H190"/></g></g>' +
      '<g class="gb oc"><rect class="fg sw t" x="70" y="74" width="34" height="18" rx="6"/>' +
        '<text class="fw" x="87" y="87" font-size="11">GIF</text></g>',

    // An egg wobbles, its top lifts to show the yolk; a price tag swings beside it.
    eggprice:
      '<ellipse class="fb" cx="46" cy="101" rx="20" ry="3" fill-opacity=".14"/><g class="eg ob">' +
        '<circle class="fg" cx="46" cy="61" r="10"/>' +
        '<path class="w" d="M22.4 58A25 36 0 0 0 21 70A25 28 0 0 0 71 70A25 36 0 0 0 69.6 58L64 62.5L58 57.5L52 62.5L46 57.5L40 62.5L34 57.5L28 62.5Z"/>' +
        '<path class="cap w" d="M22.4 58L28 62.5L34 57.5L40 62.5L46 57.5L52 62.5L58 57.5L64 62.5L69.6 58A25 36 0 0 0 22.4 58Z"/></g>' +
      '<circle class="fB" cx="94" cy="20" r="2.5"/><g class="tg ot"><path class="sq t" d="M94 20V31"/>' +
        '<path class="fw sg" d="M84 36L89 30H99L104 36V56H84Z"/>' +
        '<circle class="sg" cx="94" cy="35" r="1.5" stroke-width="2"/>' +
        '<text class="fg" x="94" y="51" font-size="12">$</text></g>',

    // Listings scatter in, a fit line draws through them, and one dot above the line gets a price tag.
    valuateeverything:
      '<path class="sq" d="M16 20V100H106"/><path class="fit sB" d="M22 94L104 42"/>' +
      '<circle class="dt oc fb" cx="28" cy="86" r="3.5"/>' +
      '<circle class="dt oc fb" cx="38" cy="88" r="3.5" style="animation-delay:-5.85s"/>' +
      '<circle class="dt oc fb" cx="48" cy="74" r="3.5" style="animation-delay:-5.7s"/>' +
      '<circle class="dt oc fb" cx="58" cy="76" r="3.5" style="animation-delay:-5.55s"/>' +
      '<circle class="dt oc fb" cx="78" cy="56" r="3.5" style="animation-delay:-5.4s"/>' +
      '<circle class="dt oc fb" cx="88" cy="58" r="3.5" style="animation-delay:-5.25s"/>' +
      '<circle class="dt oc fb" cx="98" cy="44" r="3.5" style="animation-delay:-5.1s"/>' +
      '<circle class="dt oc fg sw" cx="66" cy="48" r="4.5" stroke-width="2" style="animation-delay:-4.95s"/>' +
      '<g class="pt ob"><rect class="fg" x="56" y="22" width="20" height="14" rx="4"/>' +
        '<path class="fg" d="M62.5 35L66 40L69.5 35Z"/><text class="fw" x="66" y="33" font-size="11">$</text></g>',

    // A jar of super; a coin rises to meet a small plane flying across. Calm and slow.
    superdasp:
      '<g transform="translate(60 25)"><g class="pl"><path class="sq t" stroke-dasharray="3 5" d="M-28 2H-18"/>' +
        '<path class="sB" stroke-width="4" d="M-12 0H11"/>' +
        '<path class="sB" stroke-width="3.5" d="M3 0L-5-11M3 0L-5 11"/>' +
        '<path class="sB t" d="M-9 0L-13-5M-9 0L-13 5"/></g></g><circle class="cn fg" cx="60" cy="46" r="5"/>' +
      '<path class="w" d="M40 50H80V57C86 61 88 67 88 73V96A6 6 0 0 1 82 102H38A6 6 0 0 1 32 96V73C32 67 34 61 40 57Z"/>' +
      '<g class="sg t" fill="var(--gold)" fill-opacity=".3">' +
        '<circle cx="47" cy="93" r="6"/><circle cx="60" cy="93" r="6"/><circle cx="73" cy="93" r="6"/>' +
        '<circle cx="53.5" cy="81.5" r="6"/><circle cx="66.5" cy="81.5" r="6"/><circle cx="60" cy="70" r="6"/></g>' +
      '<rect class="fm sm" x="38" y="42" width="44" height="9" rx="3"/>'
  };

  var CSS = {
    sankeycreator: '&{--d:6s}&.s1{animation-name:taSk1}&.s2{animation-name:taSk2}' +
      '@keyframes taSk1{0%,6%{transform:scaleX(0);opacity:0}28%,80%{transform:none;opacity:1}94%,100%{transform:none;opacity:0}}' +
      '@keyframes taSk2{0%,30%{transform:scaleX(0);opacity:0}54%,80%{transform:none;opacity:1}94%,100%{transform:none;opacity:0}}',

    graphvisualiser: '&{--d:4s}&.b{animation-name:taGv}' +
      '@keyframes taGv{0%,100%{transform:none}25%{transform:scaleY(.62)}50%{transform:scaleY(1.16)}75%{transform:scaleY(.84)}}',

    canvasbuilder: '&{--d:7s}&.nt{animation-name:taCb}' +
      '@keyframes taCb{0%{transform:scale(0);opacity:0}6%{transform:scale(1.18);opacity:1}10%,56%{transform:none;opacity:1}64%,100%{transform:scale(.7);opacity:0}}',

    randompicker: '&{--d:5s}&.wh{animation-name:taRp1}&.pt{animation-name:taRp2}' +
      '@keyframes taRp1{0%{transform:none}8%{transform:rotate(-14deg);animation-timing-function:cubic-bezier(.25,.6,.15,1)}72%,100%{transform:rotate(540deg)}}' +
      '@keyframes taRp2{0%,8%,17%,27%,38%,52%,70%,100%{transform:none}12%,22%,32%,45%,61%{transform:rotate(-18deg)}}',

    rentvsownhouse: '&{--d:5s}&.bm{animation-name:taRv;transform-box:view-box;transform-origin:60px 78px}' +
      '@keyframes taRv{0%,100%{transform:rotate(7deg)}50%{transform:rotate(-7deg)}}',

    'costofliving-comparator': '&{--d:6s}&.mr{animation-name:taCl1}&.m2{transform:scaleX(-1)}&.m3{opacity:0}&.tg{animation-name:taCl2}' +
      '@keyframes taCl1{0%{transform:scaleX(-2);opacity:0}25%,75%{opacity:1}100%{transform:scaleX(2);opacity:0}}' +
      '@keyframes taCl2{0%{transform:scale(0);opacity:0}7%{transform:scale(1.15);opacity:1}11%,40%{transform:none;opacity:1}48%,100%{transform:scale(.6);opacity:0}}',

    worldclock: '&{--d:8s}&.mh{animation-name:taWc;animation-timing-function:linear}' +
      '@keyframes taWc{to{transform:rotate(360deg)}}',

    borrowingcapacity: '&{--d:5s}&.hd{animation-name:taBc1}&.sl{animation-name:taBc2}&.op{animation-name:taBc3}' +
      '&.fs{animation-name:taBc4}&.nt{animation-name:taBc5}' +
      '@keyframes taBc1{0%,8%{transform:none}34%,42%{transform:translateY(22px)}66%,100%{transform:none}}' +
      '@keyframes taBc2{0%,8%{transform:none}34%,42%{transform:scaleY(1.846)}66%,100%{transform:none}}' +
      '@keyframes taBc3{0%,36%,86%,100%{opacity:1}40%,82%{opacity:0}}' +
      '@keyframes taBc4{0%,36%,86%,100%{opacity:0}40%,82%{opacity:1}}' +
      '@keyframes taBc5{0%,42%{transform:none;opacity:1}66%,76%{transform:translateY(-22px);opacity:1}84%{transform:translateY(-22px);opacity:0}86%{transform:none;opacity:0}100%{transform:none;opacity:1}}',

    mdtopdf: '&{--d:6s}&.ln{animation-name:taMd1}&.st{animation-name:taMd2}' +
      '@keyframes taMd1{0%{transform:scaleX(0)}9%,58%{transform:none;opacity:1}66%,100%{transform:none;opacity:0}}' +
      '@keyframes taMd2{0%,36%{transform:scale(1.8);opacity:0}44%{transform:scale(.92);opacity:1}50%,80%{transform:none;opacity:1}90%,100%{transform:none;opacity:0}}',

    'powerfactory-scripter': '&{--d:5s}&.ln{animation-name:taPf1}&.cu{animation-name:taPf2}&.bt{animation-name:taPf3}&.rc{animation-name:taPf4}' +
      '@keyframes taPf1{0%{transform:scaleX(0)}10%,60%{transform:none;opacity:1}70%,100%{transform:none;opacity:0}}' +
      '@keyframes taPf2{0%,20%,40%,60%,80%,100%{opacity:1}10%,30%,50%,70%,90%{opacity:0}}' +
      '@keyframes taPf3{0%,40%{transform:scale(1.7);opacity:0}48%{transform:scale(.92);opacity:1}54%,82%{transform:none;opacity:1}92%,100%{transform:none;opacity:0}}' +
      '@keyframes taPf4{0%,52%{transform:translate(6px,6px);opacity:0}60%{transform:translate(-1px,-1px);opacity:1}64%,100%{transform:none;opacity:1}}',

    pisahvsgabung: '&{--d:6s}&.cl{animation-name:taPg1}&.cr{animation-name:taPg2}&.ht{animation-name:taPg3}' +
      '@keyframes taPg1{0%,10%,90%,100%{transform:translateX(-11px)}40%{transform:translateX(1.5px)}48%,68%{transform:none}}' +
      '@keyframes taPg2{0%,10%,90%,100%{transform:translateX(11px)}40%{transform:translateX(-1.5px)}48%,68%{transform:none}}' +
      '@keyframes taPg3{0%,38%,72%,100%{transform:scale(0);opacity:0}46%{transform:scale(1.3);opacity:1}52%,66%{transform:none;opacity:1}}',

    financingvscash: '&{--d:5s}&.bm{animation-name:taFv;transform-box:view-box;transform-origin:60px 78px}' +
      '@keyframes taFv{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}',

    dcasimulator: '&{--d:6s}&.cn{animation-name:taDc}' +
      '@keyframes taDc{0%{transform:translateY(-42px);opacity:0;animation-timing-function:cubic-bezier(.5,0,1,1)}5%{opacity:1}12%{transform:translateY(1px)}15%,60%{transform:none;opacity:1}66%,100%{transform:none;opacity:0}}',

    financialfreedom: '&{--d:6s}&.gs{transform-box:fill-box;transform-origin:0 100%;animation-name:taFf1}' +
      '&.fl{animation-name:taFf2}&.cl{animation-name:taFf3}' +
      '@keyframes taFf1{0%{transform:scale(0)}6%,64%{transform:none;opacity:1}72%,100%{transform:none;opacity:0}}' +
      '@keyframes taFf2{0%,32%{transform:scaleY(0);opacity:0}40%{transform:scaleY(1.1);opacity:1}44%,84%{transform:none;opacity:1}94%,100%{transform:none;opacity:0}}' +
      '@keyframes taFf3{0%,46%,58%,70%,100%{transform:none}52%,64%{transform:scaleX(.72) skewY(7deg)}}',

    jsonvisualiser: '&{--d:6s}&.l2{animation-name:taJv1}&.l3{animation-name:taJv2}&.rt{animation-name:taJv3}' +
      '@keyframes taJv1{0%,10%{transform:scale(0);opacity:0}22%{transform:scale(1.06);opacity:1}26%,72%{transform:none;opacity:1}84%,100%{transform:scale(0);opacity:0}}' +
      '@keyframes taJv2{0%,26%{transform:scale(0);opacity:0}38%{transform:scale(1.08);opacity:1}42%,58%{transform:none;opacity:1}70%,100%{transform:scale(0);opacity:0}}' +
      '@keyframes taJv3{0%,10%,56%,66%,100%{transform:none}5%,61%{transform:scale(.88)}}',

    videotogif: '&{--d:4s}&.fs{animation-name:taVg1}&.gb{animation-name:taVg2}' +
      '@keyframes taVg1{0%{transform:none}40%,50%{transform:translateX(-28px)}90%,100%{transform:translateX(-56px)}}' +
      '@keyframes taVg2{0%,36%,56%,86%,100%{transform:none}45%,95%{transform:scale(1.12)}}',

    eggprice: '&{--d:5s}&.eg{animation-name:taEp1}&.tg{animation-name:taEp3}' +
      '&.cap{transform-box:fill-box;transform-origin:0 100%;transform:translate(-2px,-14px) rotate(-22deg);animation-name:taEp2}' +
      '@keyframes taEp1{0%,26%,100%{transform:none}6%{transform:rotate(-6deg)}12%{transform:rotate(5deg)}18%{transform:rotate(-3deg)}}' +
      '@keyframes taEp2{0%,28%,86%,100%{transform:none}40%,74%{transform:translate(-2px,-14px) rotate(-22deg)}}' +
      '@keyframes taEp3{0%,50%,100%{transform:rotate(7deg)}25%,75%{transform:rotate(-7deg)}}',

    valuateeverything: '&{--d:6s}&.dt{animation-name:taVe1}&.fit{animation-name:taVe2;transform-box:fill-box;transform-origin:0 100%}&.pt{animation-name:taVe3}' +
      '@keyframes taVe1{0%{transform:scale(0)}6%{transform:scale(1.3)}10%,62%{transform:none;opacity:1}70%,100%{transform:none;opacity:0}}' +
      '@keyframes taVe2{0%,22%{transform:scale(0);opacity:1}42%,64%{transform:none;opacity:1}72%,100%{transform:none;opacity:0}}' +
      '@keyframes taVe3{0%,44%{transform:scale(0);opacity:0}50%{transform:scale(1.2);opacity:1}54%,64%{transform:none;opacity:1}72%,100%{transform:none;opacity:0}}',

    superdasp: '&{--d:8s}&.pl{animation-name:taSd1}&.cn{animation-name:taSd2}' +
      '@keyframes taSd1{0%{transform:translate(-36px,6px);opacity:0}16%,84%{opacity:1}100%{transform:translate(36px,-4px);opacity:0}}' +
      '@keyframes taSd2{0%,30%{transform:none;opacity:1}56%{transform:translateY(-20px);opacity:1}68%,100%{transform:translateY(-24px);opacity:0}}'
  };

  var SVG_OPEN = '" viewBox="0 0 120 120" fill="none" stroke-width="3" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true" focusable="false">';

  function init() {
    var panels = document.querySelectorAll('.tool-anim[data-anim]');
    if (!panels.length) return;

    if (!document.getElementById('home-anim-style')) {
      var css = BASE;
      for (var k in CSS) {
        if (Object.prototype.hasOwnProperty.call(CSS, k)) css += CSS[k].replace(/&/g, '.ta-' + k + ' ');
      }
      var style = document.createElement('style');
      style.id = 'home-anim-style';
      style.textContent = css;
      document.head.appendChild(style);
    }

    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        entries[i].target.classList.toggle('is-playing', entries[i].isIntersecting);
      }
    }, { rootMargin: '40px 0px' }) : null;

    for (var i = 0; i < panels.length; i++) {
      var panel = panels[i];
      var key = panel.getAttribute('data-anim');
      if (!Object.prototype.hasOwnProperty.call(ART, key) || panel.firstElementChild) continue;
      panel.innerHTML = '<svg class="ta ta-' + key + SVG_OPEN + ART[key] + '</svg>';
      if (io) io.observe(panel);
      else panel.classList.add('is-playing');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
