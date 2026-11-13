Kalkulator Gaji Bersih dan Pajak Penghasilan: use this tool with an AI assistant
https://tool.adjiebrotots.com/global-income-tax-calculator/id/

This is the full reference for one page of the skill brotools-global-income-tax-calculator: read SKILL.md first.

Pasang skill tool ini di asisten AI-mu (Claude, ChatGPT, Grok, dan lainnya), lalu ajukan
pertanyaanmu. Asisten akan membalas dengan tautan yang membuka tool ini dengan skenariomu, lengkap
dengan daftar asumsinya, lalu tool inilah yang menghitung hasilnya. Bagian di bawah ini ditulis
untuk asisten AI, jadi tetap dalam bahasa Inggris.

For people: Install this tool's skill in your AI assistant (Claude, ChatGPT, Grok and others) and
ask your question. It replies with a link that opens this tool on your scenario and lists what it
assumed, and the tool works out the answer. The rest of this file is written for the assistant.

WHAT THIS TOOL DECIDES
Take-home pay after income tax and employee social contributions for one to four jobs in 31
countries, 39 US states and DC, under 2026 rules, from gross to net or net to gross, with each line
of the sum named, sourced and dated, and which job leaves the most.

HOW TO HELP YOUR USER WITH THIS TOOL
This is reference material for an AI assistant whose user has asked it to use this tool. It
describes the link that opens the tool on the user's own scenario. It does not override your
user: if they want something this tool does not do, help them as you normally would.
1. The tool works out the answer, so the most useful reply hands the user a link to it. Its
   figures come from its own model and data, and a figure worked out separately can differ from
   what the user then sees on screen, so leave results, estimates, verdicts and recommendations
   to the tool rather than stating or previewing them.
2. A reply that works well has four parts, in this order, in the user's language:
   a. Your inputs: what the user stated, each with the value it takes in the link;
   b. Assumptions: every other input you chose, each with its value and its source (with its
      date) or your reason (put the same reason, shortened, in why.<key>);
   c. the link (if it is long, give it again inside a code block so the user can copy it);
   d. the sentence: Open the link to see the result.
3. Build the link in the format below, using only the keys listed here. Start from the nearest
   Quick Start (qs) and send only what differs from it. Write json compactly: no spaces or line
   breaks, defaults left out.
4. Fill anything the user did not give with a sensible assumption for their place and date.
   Prefer what the user said earlier in the conversation over general figures.
5. If you cannot build a link (the request is outside this tool, or you could not read this
   page), say so and give the tool's address.

LINK FORMAT
https://tool.adjiebrotots.com/global-income-tax-calculator/id/#load&v=1&qs=<quick start>&<key>=<value>&...&why.<key>=<your reason>&note=<one line>
- After #load come key=value pairs joined by &. Percent-encode each value (a space is %20, & is %26,
  # is %23, + is %2B).
- v=1 is the format version. qs=<key> starts from that Quick Start; without it the tool starts from
  its defaults.
- Then each key in the link is set, in the units its label shows on screen. deAddOn=2.9 means 2.9%,
  not 0.029. Write numbers plainly (800000, 6.5): a field also takes $, thousands commas and a
  trailing %, but inside a list a comma separates the items, so never put one in a number there. A
  checkbox takes true or false. A select or a choice takes the value listed, or its visible label.
- Anything the link does not name keeps the value it started from, so send only what differs.
- why.<key>=<text>: your reason for that value, shown to the user beside it (200 characters at
  most). note=<text>: one line shown above the list, for example the place and the date.
- A number outside a field's range is pulled into range and the user is told; a key the tool does
  not know is skipped and listed. Never use the keys s, open or embed.

EXAMPLE
Request: using tool.adjiebrotots.com/global-income-tax-calculator, what is my take-home pay on
£85,000 in London?
A reply in that form:
Your inputs:
- Gaji kotor: A$85,000
Assumptions:
1. Job: an employee in England on £85,000 a year gross, under the 2026/27 UK rules, with no student
   loan.
2. Take-home: after income tax and National Insurance only. Pension contributions through salary
   sacrifice are not included.
https://tool.adjiebrotots.com/global-income-tax-calculator/id/#load&v=1&country=GB&why.country=London%20is%20in%20England,%20so%20the%20rest%20of%20UK%20rates%20apply&ukRegion=ruk&dir=gross&amount=85000&why.amount=%C2%A385,000%20a%20year%20before%20tax,%20as%20the%20user%20said&period=yearly&note=London,%20November%202026
```
https://tool.adjiebrotots.com/global-income-tax-calculator/id/#load&v=1&country=GB&why.country=London%20is%20in%20England,%20so%20the%20rest%20of%20UK%20rates%20apply&ukRegion=ruk&dir=gross&amount=85000&why.amount=%C2%A385,000%20a%20year%20before%20tax,%20as%20the%20user%20said&period=yearly&note=London,%20November%202026
```
Open the link to see the result.

QUICK STARTS (qs)
There are 5 Quick Starts, each four jobs side by side: Asia hubs (Singapore, Hong Kong (China),
Tokyo, Dubai), European tech (London, Amsterdam with the 30% ruling, Berlin, Zurich), US states
(US$150,000 single in Texas, California, New York City and Illinois), Same take-home, Southern
Europe (the gross for €4,000 a month net in Paris, Madrid, Lisbon and Milan) and Family of four (a
sole earner on €80,000 with two children in Belgium, France, Germany and the Netherlands).
Use one only when the user's question is that comparison: a field named in the link replaces the
value in job 1 alone, and the other three jobs stay as the Quick Start has them. For the user's own
jobs, send json instead.
qs takes one of: asia, europe, us, net, family.

FIELDS (key: label on the page)
Most important: country, dir, amount, period, usState, usFiling, caProv, ukRegion, dispCur.

[Gaji: Tempat kerja]
country: Negara  (most important)
  One of: AU (Australia), CN (Tiongkok (Shanghai)), HK (Hong Kong (Tiongkok)), ID (Indonesia), JP
  (Jepang (Tokyo)), MY (Malaysia), SG (Singapura), KR (Korea Selatan), TW (Taiwan (Tiongkok)), TH
  (Thailand), BE (Belgia), EE (Estonia), FI (Finlandia), FR (Prancis), DE (Jerman), IT (Italia
  (Milan)), NL (Belanda), NO (Norwegia), PT (Portugal), ES (Spanyol (Madrid)), SE (Swedia), CH
  (Swiss (Zürich)), GB (Inggris), CA (Kanada), US (Amerika Serikat), BH (Bahrain), KW (Kuwait), OM
  (Oman), QA (Qatar), SA (Arab Saudi), AE (Uni Emirat Arab). Default AU.
  The country the job is in, by ISO code: AU, CN (Shanghai rules), HK, ID, JP (Tokyo rules), MY, SG,
  KR, TW, TH, BE, EE, FI, FR, DE, IT (Milan rules), NL, NO, PT (mainland), ES (Madrid rules), SE, CH
  (City of Zurich rules), GB, CA, US, BH, KW, OM, QA, SA, AE. A country's other fields only count
  when it is picked.
usState: Negara bagian  (most important)
  One of: AK (Alaska), AZ (Arizona), AR (Arkansas), CA (California), CO (Colorado), DE (Delaware),
  DC (District of Columbia), FL (Florida), GA (Georgia), HI (Hawaii), ID (Idaho), IL (Illinois), IN
  (Indiana), IA (Iowa), KS (Kansas), KY (Kentucky), LA (Louisiana), MD (Maryland), MA
  (Massachusetts), MI (Michigan), MS (Mississippi), MO (Missouri), MT (Montana), NE (Nebraska), NV
  (Nevada), NH (New Hampshire), NJ (New Jersey), NY (New York), NC (North Carolina), ND (North
  Dakota), OK (Oklahoma), PA (Pennsylvania), SD (South Dakota), TN (Tennessee), TX (Texas), VT
  (Vermont), VA (Virginia), WA (Washington), WV (West Virginia), WY (Wyoming). Default CA.
  US only. The state, by its two-letter code (DC for Washington DC). States with no tax on wages:
  AK, FL, NV, NH, SD, TN, TX, WA, WY. Not offered (their deduction phase-outs are not loaded), so a
  link must not name them: AL, CT, ME, MN, NM, OH, OR, RI, SC, UT, WI.
  Tip on the page: 39 negara bagian dan DC. Sebelas negara bagian tidak tersedia karena aturan
  penghapusan bertahap potongannya belum dimuat di sini.
usNyc: Tinggal di New York City
  Checkbox: true or false. Default false.
  US, New York only. true adds New York City resident tax.
  Tip on the page: New York City juga memajaki penduduknya, selain pajak negara bagian, dengan tarif
  3.078% sampai 3.876%.
caProv: Provinsi  (most important)
  One of: ON (Ontario), BC (British Columbia), AB (Alberta), QC (Quebec). Default ON.
  Canada only. ON, BC, AB or QC. Other provinces are not loaded.
ukRegion: Tempat tinggal  (most important)
  One of: ruk (Inggris, Wales, atau Irlandia Utara), sco (Skotlandia). Default ruk.
  UK only. ruk (England, Wales or Northern Ireland) or sco (Scotland), which sets the income tax
  bands.
  Tip on the page: Skotlandia punya lapisan tarif pajak penghasilan sendiri. National Insurance sama
  di seluruh Britania Raya.

[Gaji: Gajimu]
dir: Hitung dari  (most important)
  One of: gross (Gaji kotor), net (Gaji bersih). Default gross.
  gross: amount is gross pay before tax. net: amount is the take-home pay wanted, and the tool
  solves for the gross that leaves it.
amount: Gaji kotor  (most important)
  Number (A$ before it). 0 to 100,000,000,000. Default 120,000.
  The pay in the job's own currency (dollars for US, euros for FR, yen for JP), per period. Send the
  number alone, no currency.
  Tip on the page: Sebelum dipotong pajak penghasilan dan iuran karyawan. Iuran yang dibayar pemberi
  kerja di luar gaji tidak termasuk.
period: Gaji kotor (setahun or sebulan)  (most important)
  One of: yearly (setahun), monthly (sebulan). Default yearly.
  yearly or monthly, the period amount is per. A monthly salary paid 12 times a year is monthly; for
  13th or 14th month pay, send the yearly total as yearly.

[Gaji: Statusmu]
auRes: Status penduduk (Warga negara atau penduduk tetap, Penduduk sementara, bebas Medicare levy, Penduduk asing (foreign resident) or Working holiday maker)
  One of: pr (Warga negara atau penduduk tetap), temp (Penduduk sementara, bebas Medicare levy),
  foreign (Penduduk asing (foreign resident)), whm (Working holiday maker). Default pr.
  Australia. pr (citizen or permanent resident), temp (temporary resident, Medicare-exempt), foreign
  (foreign resident) or whm (working holiday maker).
  Tip on the page: Warga negara atau penduduk tetap: warga negara Australia dan pemegang visa
  permanen, misalnya visa skilled 189, 190 atau 186, atau visa partner 801 dan 100. Penduduk
  sementara: pemegang visa sementara tanpa akses Medicare, misalnya visa 482 Skills in Demand, 485
  Graduate atau 500 Student. Penduduk asing: berada di Australia kurang dari 6 bulan tanpa rencana
  menetap, misalnya dengan visa turis 600 atau visa kerja singkat 400. Working holiday maker:
  pemegang visa Working Holiday (417) atau Work and Holiday (462).
sgRes: Status penduduk
  One of: ep (Employment Pass atau S Pass), citizen (Warga negara, atau penduduk tetap mulai tahun
  ke-3), pr1 (Penduduk tetap, tahun ke-1), pr2 (Penduduk tetap, tahun ke-2), nonres (Bukan penduduk
  pajak (kurang dari 183 hari)). Default ep.
  Singapore. ep (Employment Pass or S Pass, no CPF), citizen (citizen, or PR from year 3), pr1, pr2
  (permanent resident in year 1 or 2) or nonres (under 183 days).
  Tip on the page: Employment Pass atau S Pass: profesional dan tenaga terampil asing yang memegang
  Employment Pass atau S Pass. Warga negara, atau penduduk tetap mulai tahun ke-3: warga negara
  Singapura, dan penduduk tetap mulai tahun ketiga sejak status penduduk tetap diberikan. Penduduk
  tetap, tahun ke-1: penduduk tetap Singapura yang baru, di tahun pertama sejak status penduduk
  tetap diberikan, sering kali setelah memegang Employment Pass atau S Pass. Penduduk tetap, tahun
  ke-2: penduduk tetap Singapura di tahun kedua sejak status penduduk tetap diberikan. Bukan
  penduduk pajak: siapa pun yang berada di Singapura kurang dari 183 hari dalam setahun, misalnya
  karyawan yang ditugaskan sebentar.
sgAge: Usia
  One of: 55 tahun atau kurang, 60 (Di atas 55 sampai 60), 65 (Di atas 60 sampai 65), 70 (Di atas 65
  sampai 70), 99 (Di atas 70). Default 55.
  Singapore citizens and PRs from year 3. Age band for the CPF rate: 55, 60, 65, 70 or 99 (above
  70).
  Tip on the page: Tarif iuran CPF karyawan turun seiring usia, dari 20% untuk usia 55 tahun atau
  kurang sampai 5% di atas 70 tahun.
usRes: Status pajak
  One of: res (Warga negara atau penduduk pajak), nra (Nonresident alien). Default res.
  US. res (citizen or resident) or nra (nonresident alien: no standard deduction, files as single;
  most new H-1B, L-1, F-1 holders in their first year).
  Tip on the page: Warga negara atau penduduk pajak: warga negara AS, pemegang green card, dan
  pemegang visa seperti H-1B atau L-1 yang lolos substantial presence test. Nonresident alien: tanpa
  green card dan tidak lolos substantial presence test, misalnya mahasiswa F-1 atau J-1 di 5 tahun
  kalender pertamanya, atau pendatang H-1B sebelum 183 hari.
deClass: Kelas pajak
  One of: I (Kelas I, lajang), III (Kelas III, menikah, pasangan bergaji kecil). Default I.
  Germany. I (single) or III (married, partner earns little or nothing).
  Tip on the page: Kelas I: karyawan lajang, bercerai, atau janda/duda. Pasangan yang gajinya setara
  memakai kelas IV, yang pajaknya sama. Kelas III: pasangan menikah atau terdaftar, salah satunya
  bergaji kecil atau tidak bergaji dan pasangannya masuk kelas V.
idRes: Status penduduk (Penduduk pajak or Bukan penduduk pajak (PPh 26))
  One of: res (Penduduk pajak), nonres (Bukan penduduk pajak (PPh 26)). Default res.
  Indonesia. res or nonres (under 183 days: 20% of gross, final).
  Tip on the page: Penduduk pajak: WNI, dan WNA yang berada di Indonesia 183 hari atau lebih dalam
  12 bulan atau berniat menetap, termasuk pemegang KITAS dan KITAP. Bukan penduduk pajak: WNA yang
  ditugaskan sebentar, kurang dari 183 hari dalam 12 bulan dan tidak berniat menetap.
myRes: Status penduduk (Warga negara atau penduduk tetap, Ekspatriat, penduduk pajak (182 hari atau lebih) or Ekspatriat, bukan penduduk pajak)
  One of: citizen (Warga negara atau penduduk tetap), expat (Ekspatriat, penduduk pajak (182 hari
  atau lebih)), nonres (Ekspatriat, bukan penduduk pajak). Default citizen.
  Malaysia. citizen (citizen or PR), expat (tax resident, 182 days or more) or nonres (30% flat).
  Tip on the page: Warga negara atau penduduk tetap: warga negara dan penduduk tetap Malaysia.
  Ekspatriat, penduduk pajak: WNA pemegang Employment Pass yang berada di Malaysia 182 hari atau
  lebih dalam setahun. Ekspatriat, bukan penduduk pajak: karyawan asing yang berada di Malaysia
  kurang dari 182 hari dalam setahun, misalnya karena penugasan singkat.
nlRuling: 30% ruling
  Checkbox: true or false. Default false.
  Netherlands. true for the 30% ruling (a recruited expat above the salary norm).
  Tip on the page: Untuk karyawan yang direkrut dari luar negeri dan sebelumnya tinggal lebih dari
  150 km dari perbatasan Belanda. Sampai 30% gaji bebas pajak di atas salary norm, 27% mulai 2027.
noRes: Skema (Pajak biasa or Skema PAYE, tarif tunggal 25%)
  One of: res (Pajak biasa), paye (Skema PAYE, tarif tunggal 25%). Default res.
  Norway. res (ordinary tax) or paye (25% flat scheme for short stays, up to 725,050 a year).
  Tip on the page: Pajak biasa: orang yang tinggal di Norwegia, termasuk WNA yang berada di sana
  lebih dari 183 hari dalam 12 bulan. Skema PAYE: pekerja asing yang bukan penduduk pajak Norwegia,
  misalnya yang tinggal sebentar atau pulang-pergi dari negara tetangga.
noNi: Peserta asuransi nasional Norwegia
  Checkbox: true or false. Default true.
  Norway, PAYE only. false when not a member of Norwegian national insurance (17.4%).
  Tip on the page: Tarif PAYE 25% untuk peserta dan 17.4% untuk yang bukan peserta.
seRes: Status penduduk (Penduduk pajak or Bukan penduduk pajak, SINK 22.5%)
  One of: res (Penduduk pajak), sink (Bukan penduduk pajak, SINK 22.5%). Default res.
  Sweden. res or sink (non-resident, 22.5% flat).
  Tip on the page: Penduduk pajak: orang yang tinggal di Swedia atau berada di sana 6 bulan atau
  lebih, termasuk pekerja asing dengan izin kerja. Bukan penduduk pajak, SINK: orang yang bekerja di
  Swedia tetapi tinggal di luar negeri, misalnya pekerja lintas batas atau penugasan di bawah 6
  bulan.
fiRes: Skema (Pajak biasa or Key employee, tarif tunggal 25%)
  One of: res (Pajak biasa), key (Key employee, tarif tunggal 25%). Default res.
  Finland. res or key (key employee 25% flat, needs 5,800 a month or more).
  Tip on the page: Pajak biasa: karyawan yang dikenai tarif progresif, termasuk penduduk dan WNA
  yang tinggal lebih dari 6 bulan. Key employee: tenaga ahli asing yang direkrut dari luar negeri,
  bergaji minimal 5,800 sebulan, dan tidak menjadi penduduk Finlandia dalam 5 tahun terakhir.
beExpat: Rezim ekspatriat
  Checkbox: true or false. Default false.
  Belgium. true for the expat regime (35% of gross tax-free; needs more than 70,000 a year).
  Tip on the page: Untuk karyawan yang direkrut atau ditugaskan dari luar negeri bergaji di atas
  70,000 setahun: sampai 35% gaji kotor dibayar sebagai penggantian bebas pajak dan bebas iuran.
itImp: Rezim (Penduduk pajak, Impatriat, 50% dibebaskan or Impatriat dengan anak di bawah umur, 60% dibebaskan)
  One of: none (Penduduk pajak), imp50 (Impatriat, 50% dibebaskan), imp60 (Impatriat dengan anak di
  bawah umur, 60% dibebaskan). Default none.
  Italy. none, imp50 (impatriate, 50% exempt) or imp60 (impatriate with a minor child, 60% exempt).
  Tip on the page: Penduduk pajak: orang yang tinggal di Italia dan dikenai tarif progresif biasa.
  Impatriat, 50% dibebaskan: tenaga berkualifikasi tinggi yang pindah ke Italia setelah 3 tahun di
  luar negeri (lebih lama bila tetap di pemberi kerja yang sama) dan berkomitmen tinggal 4 tahun.
  Impatriat dengan anak di bawah umur: pekerja impatriat yang sama, dengan anak di bawah umur atau
  anak yang lahir atau diadopsi selama memakai rezim ini.
frCadre: Kontrak
  One of: noncadre (Non-cadre), cadre (Cadre). Default noncadre.
  France. noncadre or cadre.
  Tip on the page: Non-cadre: karyawan yang bukan manajer atau tenaga profesional, misalnya staf
  administrasi, teknisi, dan pekerja. Cadre: manajer dan tenaga profesional yang berstatus cadre
  menurut perjanjian kerja bersama.
frImp: Rezim impatriat, forfait 30%
  Checkbox: true or false. Default false.
  France. true for the impatriate regime (30% of pay exempt from income tax).
  Tip on the page: Untuk karyawan yang direkrut dari luar negeri dan tidak menjadi penduduk pajak
  Prancis dalam 5 tahun terakhir: 30% gaji dibebaskan dari pajak penghasilan sampai 8 tahun.
esRegime: Rezim (Penduduk pajak or Rezim Beckham, tarif tunggal 24%)
  One of: res (Penduduk pajak), beckham (Rezim Beckham, tarif tunggal 24%). Default res.
  Spain. res or beckham (24% flat to 600,000).
  Tip on the page: Penduduk pajak: orang yang tinggal di Spanyol lebih dari 183 hari setahun,
  termasuk yang sudah pindah lebih dulu. Rezim Beckham: pekerja yang pindah ke Spanyol untuk
  bekerja, termasuk pemegang visa digital nomad, yang tidak menjadi penduduk Spanyol dalam 5 tahun
  terakhir.
ptRegime: Rezim (Penduduk pajak, IRS Jovem, IFICI, tarif tunggal 20% or Bukan penduduk pajak, tarif tunggal 25%)
  One of: res (Penduduk pajak), jovem (IRS Jovem), ifici (IFICI, tarif tunggal 20%), nonres (Bukan
  penduduk pajak, tarif tunggal 25%). Default res.
  Portugal. res, jovem (IRS Jovem), ifici (20% flat) or nonres (25% flat).
  Tip on the page: Penduduk pajak: orang yang tinggal di Portugal dan dikenai tarif progresif biasa.
  IRS Jovem: pekerja berusia sampai 35 tahun di 10 tahun pertama masa kerjanya, apa pun
  pendidikannya, yang tidak diklaim sebagai tanggungan. IFICI: penduduk baru di pekerjaan yang
  memenuhi syarat, misalnya peneliti, pengajar, dan bidang teknologi, yang tidak menjadi penduduk
  Portugal dalam 5 tahun terakhir. Bukan penduduk pajak: orang yang dibayar untuk pekerjaan di
  Portugal tetapi tinggal di negara lain, misalnya karena penugasan singkat.
ptJovemYear: Tahun kerja ke-
  One of: 1 (Tahun ke-1), 2 (Tahun ke-2), 3 (Tahun ke-3), 4 (Tahun ke-4), 5 (Tahun ke-5), 6 (Tahun
  ke-6), 7 (Tahun ke-7), 8 (Tahun ke-8), 9 (Tahun ke-9), 10 (Tahun ke-10). Default 1.
  Portugal, IRS Jovem only. Year of work, 1 to 10.
  Tip on the page: Bagian yang dibebaskan: 100% di tahun ke-1, 75% di tahun ke-2 sampai ke-4, 50% di
  tahun ke-5 sampai ke-7, 25% di tahun ke-8 sampai ke-10, maksimal 29,542.15.
jpRes: Status penduduk (Penduduk pajak, tahun ke-2 dan seterusnya, Penduduk pajak, tahun pertama or Bukan penduduk pajak, tarif tunggal 20.42%)
  One of: y2 (Penduduk pajak, tahun ke-2 dan seterusnya), y1 (Penduduk pajak, tahun pertama), nonres
  (Bukan penduduk pajak, tarif tunggal 20.42%). Default y2.
  Japan. y2 (resident, year 2 or later), y1 (first year: no resident tax yet) or nonres (20.42%
  flat).
  Tip on the page: Penduduk pajak, tahun ke-2 dan seterusnya: orang yang sudah terdaftar beralamat
  di Jepang pada 1 Januari, sehingga terutang pajak penduduk atas penghasilan tahun lalu. Penduduk
  pajak, tahun pertama: orang yang pindah ke Jepang tahun ini dengan visa kerja, sehingga belum
  beralamat di sana pada 1 Januari. Bukan penduduk pajak: orang tanpa tempat tinggal di Jepang yang
  berada di sana kurang dari setahun, misalnya karena penugasan singkat.
krMethod: Cara hitung pajak
  One of: prog (Tarif progresif), flat (Tarif tunggal 19% untuk pekerja asing). Default prog.
  South Korea. prog (progressive) or flat (19% election for foreign workers).
  Tip on the page: Tarif progresif: cara standar untuk semua karyawan, baik WNA maupun warga Korea.
  Tarif tunggal 19%: WNA yang bekerja di Korea dan memilih cara ini, untuk pekerjaan sampai 31 Des
  2026.
cnRes: Status
  One of: local (Standar), expat (Ekspatriat dengan tunjangan bebas pajak). Default local.
  China. local (standard) or expat (tax-free allowances in cnAllow).
  Tip on the page: Standar: warga Tiongkok, dan WNA yang memakai potongan tambahan khusus seperti
  biasa. Ekspatriat: WNA yang tinggal di Tiongkok, yang boleh menerima tunjangan perumahan, bahasa,
  dan sekolah anak bebas pajak sampai 31 Des 2027.
twRes: Status penduduk (Penduduk pajak (183 hari atau lebih) or Bukan penduduk pajak)
  One of: res (Penduduk pajak (183 hari atau lebih)), nonres (Bukan penduduk pajak). Default res.
  Taiwan (China). res (183 days or more) or nonres.
  Tip on the page: Penduduk pajak: warga negara, dan WNA pemegang izin tinggal (ARC) yang berada di
  sana 183 hari atau lebih dalam setahun. Bukan penduduk pajak: WNA yang berada di Taiwan kurang
  dari 183 hari dalam setahun, misalnya karena penugasan singkat.
twGold: Gold Card
  Checkbox: true or false. Default false.
  Taiwan (China) residents. true for a Gold Card holder (50% of salary above 3,000,000 excluded).
  Tip on the page: Pemegang Gold Card tidak dipajaki atas 50% gaji di atas 3,000,000 selama 5 tahun.
twEi: Asuransi ketenagakerjaan
  One of: yes (Ikut: 11.5% + 1%), no (Karyawan asing: 11.5% saja). Default yes.
  Taiwan (China). yes (default: in employment insurance, so 11.5% + 1% labour and employment
  insurance: citizens, foreigners married to a citizen, permanent residents) or no (other foreign
  employees on a work permit: labour insurance 11.5% only).
  Tip on the page: Ikut asuransi ketenagakerjaan: warga negara, WNA yang menikah dengan warga negara
  dan terdaftar di kartu keluarga, serta penduduk tetap. Tidak ikut: karyawan asing lain dengan izin
  kerja, yang hanya membayar asuransi tenaga kerja.
gulfNat: Kewarganegaraan
  One of: expat (Ekspatriat), national (Warga negara). Default expat.
  UAE, Qatar, Saudi Arabia, Bahrain, Kuwait, Oman. expat or national. None of them taxes wages;
  nationals pay pension contributions.
  Tip on the page: Ekspatriat: pekerja asing dengan izin tinggal kerja yang disponsori pemberi
  kerja. Warga negara: warga negara tempatmu bekerja, yang ikut skema pensiun negara itu.
saScheme: Skema GOSI
  One of: legacy (Terdaftar sebelum 3 Jul 2024), new (Peserta baru mulai 3 Jul 2024). Default
  legacy.
  Saudi nationals. legacy (joined GOSI before 3 Jul 2024) or new (new entrant).
  Tip on the page: Terdaftar sebelum 3 Jul 2024: karyawan yang sudah terdaftar di GOSI sebelum 3
  Juli 2024. Peserta baru: karyawan yang pertama kali terdaftar di GOSI mulai 3 Juli 2024. Tarifnya
  naik setiap Juli.

[Rumah tangga: Rumah tangga]
usFiling: Status pelaporan  (most important)
  One of: S (Lajang (single)), MFJ (Menikah, lapor bersama (MFJ)). Default S.
  US residents. S (single) or MFJ (married filing jointly).
deKids: Punya anak
  Checkbox: true or false. Default false.
  Germany. true if the employee has children (lowers long-term care).
  Tip on the page: Tanpa anak, iuran perawatan jangka panjang lebih tinggi 0.6 poin persentase.
idMarried: Menikah
  Checkbox: true or false. Default false.
  Indonesia, residents. true if married.
idDeps: Tanggungan (0, 1, 2 or 3)
  One of: 0, 1, 2, 3. Default 0.
  Indonesia, residents. Dependants, 0 to 3.
  Tip on the page: Setiap tanggungan menambah PTKP sebesar 4,500,000, maksimal tiga orang.
thSpouse: Pasangan tanpa penghasilan
  Checkbox: true or false. Default false.
  Thailand. true for a spouse with no income.
thKids: Anak lahir sebelum 2018
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Thailand. Children born before 2018, 0 to 6.
thKidsNew: Anak lahir 2018 atau sesudahnya
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Thailand. Children born 2018 or later, 0 to 6.
  Tip on the page: Mulai anak kedua, anak yang lahir 2018 atau sesudahnya memberi potongan 60,000,
  bukan 30,000.
mySpouse: Pasangan tanpa penghasilan
  Checkbox: true or false. Default false.
  Malaysia, residents. true for a spouse with no income.
myKids: Anak
  One of: 0, 1, 2, 3, 4, 5, 6, 7, 8. Default 0.
  Malaysia, residents. Children, 0 to 8.
beStatus: Rumah tangga (Lajang or Menikah atau kohabitasi resmi, satu pencari nafkah)
  One of: single (Lajang), married (Menikah atau kohabitasi resmi, satu pencari nafkah). Default
  single.
  Belgium. single or married (married or legal cohabitant, partner with no professional income).
  Tip on the page: Pencari nafkah tunggal boleh memindahkan sampai 30% penghasilan (maksimal 11,780)
  ke pasangannya, yang dipajaki atas bagian itu dengan bagian bebas pajaknya sendiri.
beKids: Anak tanggungan
  One of: 0, 1, 2, 3, 4, 5, 6, 7, 8. Default 0.
  Belgium. Dependent children, 0 to 8.
beSingleParent: Orang tua tunggal
  Checkbox: true or false. Default false.
  Belgium, single with children. true for a single parent.
  Tip on the page: Orang tua tunggal dengan anak tanggungan mendapat tambahan 1,980 pada bagian
  bebas pajaknya.
chStatus: Rumah tangga (Lajang or Menikah, satu pencari nafkah)
  One of: single (Lajang), married (Menikah, satu pencari nafkah). Default single.
  Switzerland. single or married (sole earner).
chKids: Anak
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Switzerland, married only. Children, 0 to 6.
frMarried: Menikah atau PACS
  Checkbox: true or false. Default false.
  France. true for a married or PACS couple taxed jointly.
  Tip on the page: Pasangan dipajaki bersama dengan dua part, satuan pembagi penghasilan di Prancis.
  Setiap anak menambah setengah part, dan anak ketiga satu part penuh.
frKids: Anak
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  France. Children, 0 to 6.
esKids: Anak
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Spain, residents. Children, 0 to 6.
ptDepOld: Tanggungan usia 7 tahun ke atas
  One of: 0, 1, 2, 3, 4. Default 0.
  Portugal. Dependants aged 7 or over, 0 to 4.
ptDepMid: Tanggungan usia 4 sampai 6 tahun
  One of: 0, 1, 2, 3, 4. Default 0.
  Portugal. Dependants aged 4 to 6, 0 to 4.
ptDepYoung: Tanggungan usia 3 tahun ke bawah
  One of: 0, 1, 2, 3, 4. Default 0.
  Portugal. Dependants aged 3 or under, 0 to 4.
  Tip on the page: Pajak berkurang 600 untuk setiap tanggungan, 726 untuk tanggungan pertama berusia
  3 tahun ke bawah, dan 900 untuk tanggungan kedua dan seterusnya berusia 6 tahun ke bawah.
caKids: Anak usia 18 tahun ke bawah
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Canada, Ontario only. Children 18 or under, 0 to 6 (Ontario Tax Reduction).
  Tip on the page: Setiap anak menambah 554 pada Ontario Tax Reduction.
hkMarried: Menikah, pasangan tanpa penghasilan
  Checkbox: true or false. Default false.
  Hong Kong (China). true for married with a partner with no income.
hkKids: Anak
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Hong Kong (China). Children, 0 to 6.
twStatus: Rumah tangga (Lajang or Menikah, lapor bersama)
  One of: single (Lajang), married (Menikah, lapor bersama). Default single.
  Taiwan (China) residents. single or married (filing jointly).
twKids: Anak di bawah umur
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Taiwan (China) residents. Minor children, 0 to 6.
krDeps: Tanggungan
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  South Korea, progressive method. Dependants beyond the employee, 0 to 6.
  Tip on the page: Setiap tanggungan menambah potongan dasar 1,500,000.

[Detail: Detail]
auCover: Asuransi rumah sakit swasta
  Checkbox: true or false. Default true.
  Australia, citizens and PRs. false when there is no private hospital cover (adds the Medicare levy
  surcharge above 105,000).
  Tip on the page: Tanpa asuransi ini, Medicare levy surcharge 1% sampai 1.5% berlaku untuk
  penghasilan di atas 105,000.
auSuper: Jumlah sudah termasuk super
  Checkbox: true or false. Default false.
  Australia. true when the amount is a package that includes the 12% super guarantee.
  Tip on the page: Aktif: jumlah yang kamu isi adalah paket gaji yang sudah memuat super guarantee
  12%. Mati: super dibayar pemberi kerja di luar gaji.
ukLoan: Pinjaman mahasiswa
  One of: none (Tidak ada), plan1 (Plan 1), plan2 (Plan 2), plan4 (Plan 4 (Skotlandia)), plan5 (Plan
  5). Default none.
  UK. none, plan1, plan2, plan4 or plan5 student loan.
  Tip on the page: 9% dari gaji di atas ambang tiap plan: 26,900, 29,385, 33,795 atau 25,000.
ukPg: Pinjaman pascasarjana
  Checkbox: true or false. Default false.
  UK. true for a postgraduate loan.
  Tip on the page: 6% dari gaji di atas 21,000, di luar cicilan plan mana pun.
deChurch: Pajak gereja
  One of: 0 (Tidak ada), 8 (8% (Bavaria, Baden-Württemberg)), 9 (9% (negara bagian lain)). Default
  0.
  Germany. 0, 8 (Bavaria, Baden-Württemberg) or 9 (other states) church tax.
  Tip on the page: Anggota gereja membayar sebagian dari pajak penghasilannya: 8% di Bavaria dan
  Baden-Württemberg, 9% di negara bagian lain.
deAddOn: Iuran tambahan asuransi kesehatan
  Number (% after it). 0 to 5. Default 2.9.
  Germany. Health fund add-on rate in %, 2.9 on average.
  Tip on the page: Setiap dana kesehatan menetapkan iuran tambahannya sendiri, dengan rata-rata 2.9%
  pada 2026. Kamu menanggung separuhnya.
usLocal: Pajak penghasilan lokal atau county
  Number (% after it). 0 to 5. Default 0.
  US. Local or county income tax on wages in %, such as a Maryland county or Philadelphia. 0 when
  none.
  Tip on the page: Beberapa kota dan county juga memajaki gaji (county di Maryland, Philadelphia,
  Detroit). Isi tarifnya atas gaji kotor.
usNyDbl: Pemberi kerja memotong iuran disabilitas NY (DBL)
  Checkbox: true or false. Default true.
  US, New York. false if the employer does not take the disability contribution from pay.
  Tip on the page: 0.5% dari gaji, maksimal 0.60 seminggu. Pemberi kerja boleh memotongnya dari gaji
  atau menanggung seluruhnya.
usFicaExempt: Bebas Social Security dan Medicare
  Checkbox: true or false. Default false.
  US, nonresident alien only. true for F, J, M or Q status (no Social Security or Medicare).
  Tip on the page: Pemegang visa F, J, M, dan Q (pelajar dan peneliti) biasanya dibebaskan.
idJkk: Tarif JKK (kecelakaan kerja)
  One of: 0.24 (0.24%, risiko sangat rendah), 0.54 (0.54%, risiko rendah), 0.89 (0.89%, risiko
  sedang), 1.27 (1.27%, risiko tinggi), 1.74 (1.74%, risiko sangat tinggi). Default 0.24.
  Indonesia, residents. Work accident premium rate: 0.24, 0.54, 0.89, 1.27 or 1.74 by the industry's
  risk.
  Tip on the page: Premi JKK, JKM, dan BPJS Kesehatan yang dibayar pemberi kerja ikut dihitung
  sebagai penghasilan kena pajak. Tarif JKK bergantung pada bidang usaha pemberi kerja.
idBpjs: Bayar BPJS seperti penduduk pajak
  Checkbox: true or false. Default true.
  Indonesia, non-residents. false if no BPJS contributions are paid.
myLindung: Klaim LINDUNG sebagai pengurang SOCSO
  Checkbox: true or false. Default false.
  Malaysia, expat residents. true to claim LINDUNG as SOCSO relief (unconfirmed for expats).
  Tip on the page: Belum pasti apakah ekspatriat boleh mengklaimnya, jadi pilihan ini mati sejak
  awal. Pengaruhnya pada pajak paling banyak RM31.50.
nlNorm: Salary norm
  One of: std (Standar (48,013)), young (Di bawah 30 tahun dengan gelar master (36,497)). Default
  std.
  Netherlands, with the 30% ruling. std (salary norm 48,013) or young (under 30 with a master's,
  36,497).
  Tip on the page: Ruling ini tidak boleh membuat gaji turun di bawah salary norm, jadi bagian bebas
  pajaknya adalah gaji dikurangi norm itu bila hasilnya lebih kecil.
nlHoliday: Uang liburan dibayar di atas gaji
  Checkbox: true or false. Default true.
  Netherlands. true (default): amount excludes the 8% holiday allowance and it is added. false:
  amount already includes it.
  Tip on the page: Gaji di Belanda ditambah uang liburan 8%, biasanya dibayar pada bulan Mei. Kalau
  aktif, jumlah yang kamu isi belum termasuk uang liburan dan 8% ditambahkan.
nlPension: Iuran pensiun, bagianmu
  Number (% after it). 0 to 15. Default 0.
  Netherlands. Employee pension contribution in % of gross.
  Tip on the page: Dipotong sebelum pajak. Diisi sebagai persentase gaji kotor; skema yang hanya
  menghitung iuran di atas bagian gaji yang dikecualikan (franchise) memotong lebih sedikit.
seMun: Tarif pajak kota
  Number (% after it). 28 to 36. Default 30.55.
  Sweden, residents. Municipal tax rate in %: 30.55 for Stockholm, 32.38 national average.
  Tip on the page: Stockholm 30.55%; rata-rata nasional 32.38%.
seBurial: Biaya penguburan
  Number (% after it). 0 to 1.5. Default 0.292.
  Sweden, residents. Burial fee in %, 0.292 on average.
  Tip on the page: Rata-rata nasional 0.292%. Anggota Gereja Swedia membayar iuran gereja sebagai
  gantinya.
eeP2: Pilar pensiun kedua
  One of: 0 (Tidak ikut), 2 (2%), 4 (4%), 6 (6%). Default 2.
  Estonia. Pension pillar II contribution: 0, 2, 4 or 6 (%).
eePension: Sudah usia pensiun
  Checkbox: true or false. Default false.
  Estonia. true at pension age (tax-free 776 a month).
  Tip on the page: Penghasilan bebas pajak menjadi 776 sebulan, bukan 700.
fiMun: Tarif pajak kota
  Number (% after it). 4 to 11. Default 5.30.
  Finland, residents. Municipal tax rate in %, 5.30 for Helsinki.
  Tip on the page: Helsinki 5.30%.
fiChurch: Tarif pajak gereja
  Number (% after it). 0 to 2.5. Default 0.
  Finland, residents. Church tax rate in %, 1.00 for a Lutheran member in Helsinki, else 0.
  Tip on the page: Untuk anggota gereja: 1.00% di Helsinki untuk gereja Lutheran.
beMun: Pajak tambahan kota
  Number (% after it). 0 to 9. Default 7.
  Belgium. Municipal surcharge in % of the federal tax, 7 by default.
  Tip on the page: Dihitung dari pajak federal. Kebanyakan kota menetapkan 6% sampai 8%.
chChurch: Anggota gereja
  Checkbox: true or false. Default false.
  Switzerland. true for a church member.
  Tip on the page: Pajak gereja sekitar 10% dari pajak dasar kanton di Kota Zürich.
chAge: Usia (tarif pensiun)
  One of: 25 sampai 34 (3.5%), 35 sampai 44 (5%), 45 sampai 54 (7.5%), 55 sampai 65 (9%). Default
  35.
  Switzerland. Age band for the pension rate: 25, 35, 45 or 55.
  Tip on the page: Kredit usia BVG dihitung atas gaji terkoordinasi, dan kamu menanggung separuhnya.
chNbu: Asuransi kecelakaan (NBU)
  Number (% after it). 0 to 3. Default 0.4.
  Switzerland. Non-occupational accident insurance rate in %, 0.4 by default.
  Tip on the page: Asuransi kecelakaan di luar pekerjaan; tarifnya bergantung pada perusahaan
  asuransinya.
chCommune: Pengali pajak kota
  Number (% after it). 70 to 130. Default 119.
  Switzerland. Communal multiplier in %, 119 for the City of Zurich.
  Tip on the page: Persentase dari pajak dasar kanton. Kota Zürich 119%.
frMutuelle: Asuransi kesehatan perusahaan, bagianmu
  Number (A$ before it, /thn after it). 0 to 100,000. Default 0.
  France. Your share of company health and protection cover a year, in euros. 0 when not known.
  Tip on the page: Asuransi kesehatan dan perlindungan wajib dari perusahaan. Bagianmu dipotong dari
  gaji dan dikurangkan sebelum pajak.
esTemp: Kontrak sementara
  Checkbox: true or false. Default false.
  Spain. true for a temporary contract.
  Tip on the page: Iuran asuransi pengangguran 1.60%, bukan 1.55%.
ptHealth: Biaya kesehatan
  Number (A$ before it, /thn after it). 0 to 1,000,000. Default 0.
  Portugal, residents. Health expenses a year, in euros.
  Tip on the page: 15% mengurangi pajak, maksimal 1,000.
ptEdu: Biaya pendidikan
  Number (A$ before it, /thn after it). 0 to 1,000,000. Default 0.
  Portugal, residents. Education expenses a year, in euros.
  Tip on the page: 30% mengurangi pajak, maksimal 800.
ptRent: Sewa rumah tinggalmu
  Number (A$ before it, /thn after it). 0 to 1,000,000. Default 0.
  Portugal, residents. Rent on the permanent home a year, in euros.
  Tip on the page: 15% mengurangi pajak, maksimal 900 untuk sewa tahun 2026.
ptColeta: Pengurang biaya keluarga umum
  Number (A$ before it, /thn after it). 0 to 250. Default 250.
  Portugal, residents. General family expenses deduction, 0 to 250 (250 when the cap is reached, the
  default).
  Tip on the page: 35% dari belanja sehari-hari yang tercatat di faktur e-Fatura, maksimal 250.
  Kebanyakan orang mencapai batas itu.
jpCare: Usia 40 sampai 64
  Checkbox: true or false. Default false.
  Japan. true when aged 40 to 64 (long-term care premium).
  Tip on the page: Menambah premi perawatan jangka panjang: iuran kesehatan menjadi 11.47%, bukan
  9.85%, ditanggung separuh-separuh.
jpSupport: Iuran dukungan anak
  One of: 12 (Setahun penuh), 9 (Tahun kalender 2026 (April sampai Desember)). Default 12.
  Japan. 12 (a full steady year) or 9 (calendar 2026, April to December) months of the child-support
  levy.
  Tip on the page: Iuran 0.23% ini mulai berlaku untuk gaji April 2026. Pilih Setahun penuh untuk
  melihat tahun ketika iuran ini sudah berjalan normal.
cnHf: Tarif dana perumahan
  One of: 5 (5%), 6 (6%), 7 (7%). Default 7.
  China. Housing fund rate: 5, 6 or 7 (%).
  Tip on the page: Pemberi kerja menetapkannya antara 5% dan 7%.
cnAllow: Tunjangan bebas pajak
  Number (A$ before it, /thn after it). 0 to 100,000,000. Default 0.
  China, expats. Tax-free housing, language and school allowances a year, in yuan.
  Tip on the page: Tunjangan perumahan, kursus bahasa, dan pendidikan anak dalam setahun.
cnSpecial: Potongan tambahan khusus
  Number (A$ before it, /thn after it). 0 to 1,000,000. Default 0.
  China, local. Special additional deductions a year, in yuan.
  Tip on the page: Anak, perawatan orang tua, sewa rumah atau bunga KPR, dan pendidikan lanjutan.
hkMpf: Peserta MPF
  Checkbox: true or false. Default true.
  Hong Kong (China). false when exempt from MPF.
  Tip on the page: 5% dari gaji, maksimal 1,500 sebulan, dan nol untuk gaji di bawah 7,100 sebulan.
  Bisa dikurangkan dari penghasilan sampai 18,000.
gulfWagePct: Porsi gaji yang dikenai iuran
  Number (% after it). 0 to 100. Default 100.
  Gulf states. Share of pay that contributions are charged on, in %; 100 by default (Saudi Arabia
  counts basic pay plus housing).
  Tip on the page: Iuran dihitung dari upah yang dikenai iuran (di Arab Saudi, gaji pokok ditambah
  tunjangan perumahan). Turunkan angka ini kalau tunjangan tidak ikut dihitung.

[Beside the results]
dispCur: Mata uang untuk menampilkan angka  (most important)
  One of: local (Mata uang tiap pekerjaan), USD (Dolar AS (USD)), EUR (Euro (EUR)), GBP (Pound
  sterling (GBP)), AUD (Dolar Australia (AUD)), SGD (Dolar Singapura (SGD)), IDR (Rupiah (IDR)), JPY
  (Yen Jepang (JPY)), CHF (Franc Swiss (CHF)), CAD (Dolar Kanada (CAD)), HKD (Dolar Hong Kong
  (HKD)), AED (Dirham UEA (AED)), CNY (Yuan Tiongkok (CNY)), KRW (Won Korea (KRW)), MYR (Ringgit
  Malaysia (MYR)), THB (Baht Thailand (THB)), TWD (Dolar Taiwan Baru (TWD)), SEK (Krona Swedia
  (SEK)), NOK (Krone Norwegia (NOK)), SAR (Riyal Arab Saudi (SAR)), QAR (Riyal Qatar (QAR)), BHD
  (Dinar Bahrain (BHD)), KWD (Dinar Kuwait (KWD)), OMR (Rial Oman (OMR)). Default local.
  Display only. local (each job in its own currency) or a code (USD, EUR, GBP, AUD, SGD, IDR, JPY,
  CHF, CAD, HKD, AED, CNY, KRW, MYR, THB, TWD, SEK, NOK, SAR, QAR, BHD, KWD, OMR) to read every job
  in one currency. Comparing jobs in different currencies reads best in one.
dispPer: Tampilkan angka per tahun atau per bulan
  One of: year (Tahun), month (Bulan). Default year.
  Display only. year or month.
chartMeasure: Tampilkan gaji bersih sebagai
  One of: pct (% dari gaji kotor), amount (Jumlah). Default pct.
  Display only. What the chart across the pay range reads: pct (take-home as a share of gross, the
  default) or amount (take-home pay a year).

JSON
`json={"jobs":[{...},{...}]}` sets one to four jobs. Each job is an object of the field keys above, for its own country: country (required, the ISO code), dir, amount (a number), period, and any of that country's fields. A field left out keeps its default. A field named in the link outside the json (amount=95000) replaces that value in job 1. Use json for the user's own comparison; a Quick Start's jobs are examples.
`json={"jobs":[{"country":"US","usState":"TX","amount":150000},{"country":"US","usState":"NY","usNyc":true,"amount":150000}]}`

Generated by _ref/agent-doc.mjs from the page and its agent-notes.md.
