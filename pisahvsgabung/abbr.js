/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

(function(){
/* ── PPh 21 Pisah vs Gabung (Indonesian personal income tax) ── */
var PISAH_TERMS = {
  PPh:   { en: ['Pajak Penghasilan', 'Indonesian income tax. PPh 21 is the tax on personal employment income'],
           id: ['Pajak Penghasilan', 'PPh 21 adalah pajak atas penghasilan orang pribadi dari pekerjaan'] },
  PTKP:  { en: ['Penghasilan Tidak Kena Pajak', 'the slice of yearly income that is not taxed at all'],
           id: ['Penghasilan Tidak Kena Pajak', 'bagian penghasilan setahun yang tidak dikenai pajak'] },
  PKP:   { en: ['Penghasilan Kena Pajak', 'income left after PTKP and deductions, the figure the brackets run on'],
           id: ['Penghasilan Kena Pajak', 'penghasilan setelah PTKP dan pengurang, dasar perhitungan lapisan tarif'] },
  SPT:   { en: ['Surat Pemberitahuan Tahunan', 'the annual tax return'],
           id: ['Surat Pemberitahuan Tahunan', 'laporan pajak yang disampaikan setiap tahun'] },
  /* The single letters the PTKP section spells its codes out of, and the
     ones the computed-PTKP line uses for each spouse. Both pages carry
     both sets, so a reader switching language still gets a definition. */
  TK: { en: ['Tidak Kawin', 'not married'],
        id: ['Tidak Kawin', 'belum atau tidak menikah'] },
  K:  { en: ['Kawin', 'married'],
        id: ['Kawin', 'menikah'] },
  I:  { en: ['Istri', 'the wife, whose income is combined with her husband\u2019s in the tax computation'],
        id: ['Istri', 'penghasilan istri digabung dalam perhitungan pajak'] },
  H:  { en: ['Husband', 'the husband\u2019s side of the Gabung Harta computation'],
        id: ['Husband', 'sisi suami dalam skema Gabung Harta'] },
  W:  { en: ['Wife', 'the wife\u2019s side of the Gabung Harta computation'],
        id: ['Wife', 'sisi istri dalam skema Gabung Harta'] },
  S:  { en: ['Suami', 'the husband\u2019s side of the Gabung Harta computation'],
        id: ['Suami', 'sisi suami dalam skema Gabung Harta'] }
  /* The numbered status codes (TK/0 … K/I/3) are added below: they only
     differ by the dependant count, so writing all twelve out by hand would
     be twelve chances to let one drift out of step with the others. */
};

/* PTKP status codes carry the dependant count, and the tool lets a reader pick
   0 to 3, so "K/I/2" has to define itself as readily as "K/I/0" does. One pass
   writes the whole ladder, which keeps the three families worded alike. */
(function expandPtkpCodes(scope, max){
  var dep = {
    en: ['no dependants', 'one dependant', 'two dependants', 'three dependants'],
    id: ['tanpa tanggungan', 'satu tanggungan', 'dua tanggungan', 'tiga tanggungan']
  };
  var family = [
    { code: 'TK/', en: 'Tidak Kawin', id: 'Tidak Kawin',
      enGloss: 'single, ', idGloss: 'lajang, ' },
    { code: 'K/',  en: 'Kawin', id: 'Kawin',
      enGloss: 'married, ', idGloss: 'kawin, ' },
    { code: 'K/I/', en: 'Kawin, Istri berpenghasilan', id: 'Kawin, penghasilan Istri digabung',
      enGloss: 'married with the spouse income combined, ', idGloss: 'kawin dengan penghasilan istri digabung, ' }
  ];
  for (var f = 0; f < family.length; f++) {
    for (var n = 0; n <= max; n++) {
      scope[family[f].code + n] = {
        en: [family[f].en + ', ' + n + ' tanggungan', family[f].enGloss + dep.en[n]],
        id: [family[f].id + ', ' + n + ' tanggungan', family[f].idGloss + dep.id[n]]
      };
    }
  }
})(PISAH_TERMS, 3);

SharedAbbr.glossary('pisahvsgabung', PISAH_TERMS);
})();
