/* ────────────────────────────────────────────────────────────────────────────
   Shared cashflow CSV + chart export utilities for the Rent vs Own tools.

   Loaded by BOTH the main calculator (rentvsownhouse/) and the sensitivity tool
   (rentvsownhouse/sensitivity/) so that the Own/Rent cashflow CSVs and the chart
   PNG/SVG exports are produced by exactly the same code — guaranteeing identical
   output for identical inputs and avoiding drift between the two pages.

   Exposes window.RVOExport.
   ──────────────────────────────────────────────────────────────────────────── */
(function(global){
'use strict';

/* Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports. */
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
// Watermark wordmark ("Made using tool.adjiebrotots.com/rentvsownhouse") baked to DM Sans 500 glyph
// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.
const WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM180.1 0V-5.69H181.09L181.18 -4.65Q181.38 -5.03 181.69 -5.29Q182 -5.55 182.43 -5.68Q182.86 -5.82 183.4 -5.82V-4.66H182.86Q182.53 -4.66 182.23 -4.58Q181.93 -4.5 181.7 -4.3Q181.46 -4.11 181.33 -3.79Q181.2 -3.46 181.2 -2.96V0ZM186.92 0.13Q186.13 0.13 185.52 -0.24Q184.92 -0.61 184.57 -1.27Q184.23 -1.94 184.23 -2.83Q184.23 -3.72 184.57 -4.4Q184.91 -5.07 185.52 -5.44Q186.14 -5.82 186.94 -5.82Q187.77 -5.82 188.35 -5.45Q188.93 -5.08 189.23 -4.46Q189.54 -3.84 189.54 -3.09Q189.54 -2.98 189.54 -2.86Q189.54 -2.74 189.52 -2.59H185.04V-3.36H188.45Q188.42 -4.1 187.99 -4.5Q187.57 -4.91 186.93 -4.91Q186.49 -4.91 186.12 -4.7Q185.75 -4.49 185.53 -4.08Q185.31 -3.67 185.31 -3.05V-2.74Q185.31 -2.11 185.53 -1.67Q185.75 -1.23 186.11 -1.01Q186.48 -0.78 186.92 -0.78Q187.47 -0.78 187.8 -1Q188.12 -1.22 188.28 -1.61H189.38Q189.24 -1.11 188.91 -0.72Q188.57 -0.32 188.07 -0.1Q187.57 0.13 186.92 0.13ZM190.8 0V-5.69H191.79L191.85 -4.77Q192.1 -5.26 192.58 -5.54Q193.06 -5.82 193.69 -5.82Q194.35 -5.82 194.82 -5.56Q195.29 -5.31 195.55 -4.79Q195.81 -4.28 195.81 -3.51V0H194.71V-3.4Q194.71 -4.13 194.37 -4.51Q194.02 -4.88 193.4 -4.88Q192.98 -4.88 192.64 -4.69Q192.3 -4.49 192.1 -4.12Q191.9 -3.74 191.9 -3.2V0ZM199.62 0Q199.1 0 198.71 -0.16Q198.33 -0.33 198.12 -0.71Q197.91 -1.1 197.91 -1.76V-4.76H196.93V-5.69H197.91L198.05 -7.14H199.01V-5.69H200.6V-4.76H199.01V-1.75Q199.01 -1.28 199.21 -1.11Q199.4 -0.94 199.89 -0.94H200.57V0ZM203.47 0 201.33 -5.69H202.49L204.12 -1.05L205.76 -5.69H206.9L204.77 0ZM210.05 0.13Q209.28 0.13 208.75 -0.11Q208.23 -0.34 207.95 -0.77Q207.66 -1.19 207.61 -1.75H208.72Q208.77 -1.48 208.92 -1.26Q209.07 -1.03 209.35 -0.9Q209.63 -0.76 210.05 -0.76Q210.4 -0.76 210.64 -0.87Q210.88 -0.97 211 -1.16Q211.13 -1.34 211.13 -1.58Q211.13 -1.9 210.97 -2.07Q210.82 -2.25 210.53 -2.35Q210.25 -2.44 209.82 -2.5Q209.38 -2.58 209.01 -2.69Q208.63 -2.81 208.36 -3Q208.09 -3.19 207.94 -3.48Q207.79 -3.77 207.79 -4.17Q207.79 -4.65 208.05 -5.02Q208.31 -5.4 208.78 -5.61Q209.26 -5.82 209.92 -5.82Q210.87 -5.82 211.43 -5.38Q211.99 -4.95 212.09 -4.16H211.02Q210.97 -4.52 210.68 -4.72Q210.39 -4.92 209.91 -4.92Q209.4 -4.92 209.14 -4.74Q208.88 -4.55 208.88 -4.24Q208.88 -4.02 209.01 -3.85Q209.14 -3.68 209.43 -3.56Q209.71 -3.44 210.17 -3.37Q210.82 -3.27 211.28 -3.1Q211.74 -2.93 212 -2.59Q212.25 -2.26 212.24 -1.66Q212.25 -1.1 211.97 -0.7Q211.7 -0.3 211.2 -0.08Q210.71 0.13 210.05 0.13ZM216.11 0.13Q215.31 0.13 214.69 -0.24Q214.07 -0.61 213.72 -1.28Q213.37 -1.95 213.37 -2.84Q213.37 -3.74 213.72 -4.41Q214.08 -5.08 214.7 -5.45Q215.33 -5.82 216.13 -5.82Q216.94 -5.82 217.55 -5.45Q218.17 -5.08 218.52 -4.41Q218.87 -3.74 218.87 -2.84Q218.87 -1.95 218.52 -1.28Q218.16 -0.61 217.54 -0.24Q216.92 0.13 216.11 0.13ZM216.11 -0.81Q216.57 -0.81 216.94 -1.04Q217.31 -1.27 217.53 -1.72Q217.75 -2.17 217.75 -2.84Q217.75 -3.52 217.53 -3.97Q217.32 -4.42 216.95 -4.65Q216.59 -4.87 216.13 -4.87Q215.68 -4.87 215.31 -4.65Q214.93 -4.42 214.71 -3.97Q214.49 -3.52 214.49 -2.84Q214.49 -2.17 214.71 -1.72Q214.93 -1.27 215.29 -1.04Q215.66 -0.81 216.11 -0.81ZM221.35 0 219.68 -5.69H220.77L221.97 -1.16L221.89 -1.16L223.19 -5.69H224.42L225.73 -1.17L225.64 -1.16L226.84 -5.69H227.94L226.27 0H225.13L223.76 -4.72H223.85L222.48 0ZM228.95 0V-5.69H229.93L230 -4.77Q230.25 -5.26 230.73 -5.54Q231.21 -5.82 231.84 -5.82Q232.49 -5.82 232.97 -5.56Q233.44 -5.31 233.7 -4.79Q233.96 -4.28 233.96 -3.51V0H232.86V-3.4Q232.86 -4.13 232.51 -4.51Q232.17 -4.88 231.54 -4.88Q231.13 -4.88 230.79 -4.69Q230.45 -4.49 230.25 -4.12Q230.05 -3.74 230.05 -3.2V0ZM235.45 0V-7.92H236.55V-4.79Q236.83 -5.27 237.32 -5.54Q237.8 -5.82 238.38 -5.82Q239.06 -5.82 239.53 -5.56Q240 -5.3 240.25 -4.78Q240.49 -4.26 240.49 -3.47V0H239.4V-3.35Q239.4 -4.11 239.06 -4.5Q238.72 -4.88 238.09 -4.88Q237.67 -4.88 237.32 -4.68Q236.96 -4.48 236.76 -4.09Q236.55 -3.7 236.55 -3.14V0ZM244.5 0.13Q243.7 0.13 243.08 -0.24Q242.46 -0.61 242.11 -1.28Q241.76 -1.95 241.76 -2.84Q241.76 -3.74 242.11 -4.41Q242.47 -5.08 243.09 -5.45Q243.72 -5.82 244.52 -5.82Q245.33 -5.82 245.94 -5.45Q246.56 -5.08 246.91 -4.41Q247.26 -3.74 247.26 -2.84Q247.26 -1.95 246.91 -1.28Q246.55 -0.61 245.93 -0.24Q245.31 0.13 244.5 0.13ZM244.5 -0.81Q244.96 -0.81 245.33 -1.04Q245.7 -1.27 245.92 -1.72Q246.14 -2.17 246.14 -2.84Q246.14 -3.52 245.93 -3.97Q245.71 -4.42 245.35 -4.65Q244.98 -4.87 244.52 -4.87Q244.07 -4.87 243.7 -4.65Q243.32 -4.42 243.1 -3.97Q242.88 -3.52 242.88 -2.84Q242.88 -2.17 243.1 -1.72Q243.32 -1.27 243.69 -1.04Q244.05 -0.81 244.5 -0.81ZM250.66 0.13Q250.01 0.13 249.53 -0.12Q249.06 -0.37 248.8 -0.88Q248.54 -1.4 248.54 -2.16V-5.69H249.64V-2.29Q249.64 -1.54 249.99 -1.17Q250.33 -0.8 250.96 -0.8Q251.37 -0.8 251.71 -1Q252.04 -1.19 252.24 -1.56Q252.44 -1.94 252.44 -2.48V-5.69H253.54V0H252.56L252.49 -0.92Q252.25 -0.43 251.77 -0.15Q251.29 0.13 250.66 0.13ZM257.21 0.13Q256.45 0.13 255.92 -0.11Q255.4 -0.34 255.11 -0.77Q254.83 -1.19 254.78 -1.75H255.89Q255.94 -1.48 256.09 -1.26Q256.24 -1.03 256.52 -0.9Q256.8 -0.76 257.22 -0.76Q257.57 -0.76 257.81 -0.87Q258.05 -0.97 258.17 -1.16Q258.29 -1.34 258.29 -1.58Q258.29 -1.9 258.14 -2.07Q257.99 -2.25 257.7 -2.35Q257.41 -2.44 256.99 -2.5Q256.55 -2.58 256.17 -2.69Q255.8 -2.81 255.53 -3Q255.26 -3.19 255.11 -3.48Q254.96 -3.77 254.96 -4.17Q254.96 -4.65 255.22 -5.02Q255.47 -5.4 255.95 -5.61Q256.43 -5.82 257.08 -5.82Q258.04 -5.82 258.6 -5.38Q259.16 -4.95 259.26 -4.16H258.19Q258.13 -4.52 257.84 -4.72Q257.55 -4.92 257.07 -4.92Q256.57 -4.92 256.31 -4.74Q256.05 -4.55 256.05 -4.24Q256.05 -4.02 256.18 -3.85Q256.31 -3.68 256.59 -3.56Q256.88 -3.44 257.34 -3.37Q257.99 -3.27 258.45 -3.1Q258.91 -2.93 259.17 -2.59Q259.42 -2.26 259.41 -1.66Q259.41 -1.1 259.14 -0.7Q258.87 -0.3 258.37 -0.08Q257.88 0.13 257.21 0.13ZM263.23 0.13Q262.44 0.13 261.83 -0.24Q261.22 -0.61 260.88 -1.27Q260.54 -1.94 260.54 -2.83Q260.54 -3.72 260.88 -4.4Q261.22 -5.07 261.83 -5.44Q262.44 -5.82 263.25 -5.82Q264.08 -5.82 264.66 -5.45Q265.24 -5.08 265.54 -4.46Q265.84 -3.84 265.84 -3.09Q265.84 -2.98 265.84 -2.86Q265.84 -2.74 265.83 -2.59H261.34V-3.36H264.75Q264.73 -4.1 264.3 -4.5Q263.87 -4.91 263.23 -4.91Q262.8 -4.91 262.43 -4.7Q262.06 -4.49 261.84 -4.08Q261.61 -3.67 261.61 -3.05V-2.74Q261.61 -2.11 261.83 -1.67Q262.05 -1.23 262.42 -1.01Q262.78 -0.78 263.23 -0.78Q263.78 -0.78 264.1 -1Q264.43 -1.22 264.59 -1.61H265.69Q265.55 -1.11 265.21 -0.72Q264.88 -0.32 264.38 -0.1Q263.88 0.13 263.23 0.13Z";
const WM_PATH_W = 266.34;
const WM_TEXT = 'Made using tool.adjiebrotots.com/rentvsownhouse';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const isLightTheme = () => document.body.classList.contains('light');

/* ──────────────────────────────────────────────────────────────────────────
   CSV BUILDERS — produce plain CSV text with NO icons/emojis.
   Operate on the row objects produced by computeModel (identical field schema
   in both the main tool and the sensitivity tool).
   ────────────────────────────────────────────────────────────────────────── */
const CSV_PREFIX = '# ' + WM_TEXT + '\n';

function ownCashflowCSV(rows){
  const na = '';
  const headers = ['Year','Beg_Cash','Ann_Budget','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost'];
  const lines = rows.map(r=>{
    const y0 = r.year===0;
    const hasLoanYr = !y0 && ((r.ownYearInterest||0)>0 || (r.ownYearPrincipal||0)>0);
    return [
      r.year,
      y0?na:(r.ownBegCash||0).toFixed(0),
      y0?na:(r.ownYearBudget||0).toFixed(0),
      y0?na:(r.ownYearPrincipal||0).toFixed(0),
      y0?na:(r.ownYearInterest||0).toFixed(0),
      y0?na:(r.ownYearOngoing||0).toFixed(0),
      y0?na:(r.ownYearInterestInc||0).toFixed(0),
      y0?na:(r.ownYearSurplus||0).toFixed(0),
      (r.ownCash||0).toFixed(0),
      (hasLoanYr && r.ownRateYr!==undefined)?r.ownRateYr.toFixed(2):na,
      (r.ownPropValue||0).toFixed(0),
      (r.ownPrincipal||0).toFixed(0),
      (r.ownHouseEquity||0).toFixed(0),
      (r.ownNetEquity||0).toFixed(0),
      (r.ownAccumCost||0).toFixed(0),
    ].join(',');
  });
  return CSV_PREFIX + [headers.join(','), ...lines].join('\n');
}

function rentCashflowCSV(rows){
  const na = '';
  const headers = ['Year','Beg_Cash','Ann_Budget','Rent_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Net_Equity','Accum_Cost'];
  const lines = rows.map(r=>{
    const y0 = r.year===0;
    return [
      r.year,
      y0?na:(r.rentBegCash||0).toFixed(0),
      y0?na:(r.ownYearBudget||0).toFixed(0),
      y0?na:(r.rentRent||0).toFixed(0),
      y0?na:(r.rentYearOngoing||0).toFixed(0),
      y0?na:(r.rentYearInterestInc||0).toFixed(0),
      y0?na:(r.rentYearSurplus||0).toFixed(0),
      (r.rentCash||0).toFixed(0),
      (r.rentNetEquity||0).toFixed(0),
      y0?na:(r.rentAccumCost||0).toFixed(0),
    ].join(',');
  });
  return CSV_PREFIX + [headers.join(','), ...lines].join('\n');
}

function rtbCashflowCSV(rows){
  const na = '';
  const headers = ['Year','Phase','Beg_Cash','Ann_Budget','Total_Exp','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost'];
  const lines = rows.map(r=>{
    const y0 = r.year===0, own = r.phase!=='rent';
    const cash = r.phase==='rent' ? (r.rtbCash||0) : (r.rtbCash2||0);
    const tot = (r.rtbYearPrincipal||0)+(r.rtbYearInterest||0)+(r.rtbYearOngoing||0);
    const rtbHasLoanYr = own && r.rtbRateYr!==undefined && ((r.rtbYearInterest||0)>0 || (r.rtbYearPrincipal||0)>0);
    return [
      r.year, r.phase,
      y0?na:(r.rtbBegCash||0).toFixed(0),
      y0?na:(r.rtbYearBudget||0).toFixed(0),
      y0?na:tot.toFixed(0),
      (y0||!own)?na:(r.rtbYearPrincipal||0).toFixed(0),
      (y0||!own)?na:(r.rtbYearInterest||0).toFixed(0),
      y0?na:(r.rtbYearOngoing||0).toFixed(0),
      y0?na:(r.rtbYearInterestInc||0).toFixed(0),
      y0?na:(r.rtbYearSurplus||0).toFixed(0),
      cash.toFixed(0),
      rtbHasLoanYr?r.rtbRateYr.toFixed(2):na,
      (y0||!own)?na:(r.rtbPropValue||0).toFixed(0),
      (y0||!own)?na:(r.rtbPrincipal||0).toFixed(0),
      (y0||!own)?na:(r.rtbHouseEquity||0).toFixed(0),
      (r.rtbNetEquity||0).toFixed(0),
      y0?na:(r.rtbAccumCost||0).toFixed(0),
    ].join(',');
  });
  return CSV_PREFIX + [headers.join(','), ...lines].join('\n');
}

/* Normalise CSV text to plain ASCII-friendly output: drop emoji/pictographs and
   convert typographic dashes, the minus sign and the delta glyph to plain
   characters, so spreadsheets never render mojibake like "â€”" / "Î”" / "âˆ’". */
function cleanCSV(text){
  return String(text||'')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[‒–—―−]/g, '-')
    .replace(/Δ/g, 'd');
}

function downloadCSV(filename, csvText){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([cleanCSV(csvText)], {type:'text/csv;charset=utf-8;'}));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

/* ──────────────────────────────────────────────────────────────────────────
   CHART IMAGE EXPORT — render a source <canvas> (a live Chart.js chart) to a
   titled, legended, watermarked PNG or SVG. Shared by the main chart-card and
   the sensitivity scenario popup.
     opts: { title, legendItems:[{label,color}], filename, download }
   ────────────────────────────────────────────────────────────────────────── */
function exportChartPNG(src, opts){
  opts = opts || {};
  if(!src) return null;
  const legendItems = opts.legendItems || [];
  const dpr = window.devicePixelRatio || 1;
  const OUT = 3;
  const chartW = Math.round(src.width / dpr * OUT);
  const chartH = Math.round(src.height / dpr * OUT);
  const isLight = isLightTheme();
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = '"DM Sans", sans-serif';

  const titleFontPx = Math.round(14 * OUT);
  const legendFontPx = Math.round(11 * OUT);
  const titleH = Math.round(40 * OUT);
  const legendH = legendItems.length ? Math.round(34 * OUT) : 0;

  const tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH;
  const ctx = tmp.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  ctx.font = `700 ${titleFontPx}px ${FONT}`;
  ctx.fillStyle = fgColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.title || '', tmp.width / 2, titleH / 2);

  ctx.drawImage(src, 0, titleH, chartW, chartH);

  if(legendItems.length){
    const ly = titleH + chartH;
    const dotR = Math.round(5 * OUT);
    const gap = Math.round(7 * OUT);
    const pad = Math.round(20 * OUT);
    ctx.font = `500 ${legendFontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    let totalW = 0;
    legendItems.forEach((item, i) => {
      totalW += dotR * 2 + gap + ctx.measureText(item.label).width + (i < legendItems.length - 1 ? pad : 0);
    });
    let x = Math.max(Math.round(16 * OUT), (tmp.width - totalW) / 2);
    const cy = ly + legendH / 2;
    legendItems.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x + dotR, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
      x += dotR * 2 + gap;
      ctx.fillStyle = fgColor;
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x, cy);
      x += ctx.measureText(item.label).width + pad;
    });
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.font = `500 ${Math.round(11 * OUT)}px ${FONT}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  {
    const wmX = tmp.width - Math.round(12 * OUT);
    const wmY = tmp.height - Math.round(12 * OUT);
    const wmTextW = ctx.measureText(WM_TEXT).width;
    const wmLogoSize = Math.round(13 * OUT);
    if(wmLogoImg.complete && wmLogoImg.naturalWidth){
      ctx.drawImage(wmLogoImg, wmX - wmTextW - Math.round(4 * OUT) - wmLogoSize, wmY - wmLogoSize + Math.round(2 * OUT), wmLogoSize, wmLogoSize);
    }
    ctx.fillText(WM_TEXT, wmX, wmY);
  }
  ctx.restore();

  if(opts.download !== false){
    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = opts.filename || 'rent_vs_own_chart.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  return tmp;
}

async function copyChartPNG(src, opts){
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const canvas = exportChartPNG(src, Object.assign({}, opts, {download:false}));
  if(!canvas) throw new Error('Could not build chart image.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function exportChartSVG(src, opts){
  opts = opts || {};
  if(!src) return;
  const legendItems = opts.legendItems || [];
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = isLightTheme();
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const titleH = 40;
  const legendH = legendItems.length ? 34 : 0;
  const svgW = chartW, svgH = chartH + titleH + legendH;
  const NS = 'http://www.w3.org/2000/svg', xl = 'http://www.w3.org/1999/xlink';
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('xmlns',NS); svg.setAttribute('xmlns:xlink',xl);
  svg.setAttribute('width',svgW); svg.setAttribute('height',svgH);
  svg.setAttribute('viewBox',`0 0 ${svgW} ${svgH}`);
  const bgRect = document.createElementNS(NS,'rect');
  bgRect.setAttribute('width',svgW); bgRect.setAttribute('height',svgH); bgRect.setAttribute('fill',bgColor);
  svg.appendChild(bgRect);
  const t = document.createElementNS(NS,'text');
  t.setAttribute('x',svgW/2); t.setAttribute('y',titleH/2);
  t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
  t.setAttribute('font-family',FONT); t.setAttribute('font-size','14'); t.setAttribute('font-weight','700'); t.setAttribute('fill',fgColor);
  t.textContent = opts.title || ''; svg.appendChild(t);
  const img = document.createElementNS(NS,'image');
  img.setAttribute('x',0); img.setAttribute('y',titleH);
  img.setAttribute('width',chartW); img.setAttribute('height',chartH);
  img.setAttributeNS(xl,'href',src.toDataURL('image/png'));
  svg.appendChild(img);
  if(legendItems.length){
    const dotR=5, gap=7, pad=20;
    const cy = titleH + chartH + legendH/2;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = '500 11px DM Sans, sans-serif';
    const totalW = legendItems.reduce((s,item,i) => s + dotR*2 + gap + mc.measureText(item.label).width + (i<legendItems.length-1?pad:0), 0);
    let x = Math.max(16, (svgW - totalW) / 2);
    legendItems.forEach(item => {
      const c = document.createElementNS(NS,'circle');
      c.setAttribute('cx',x+dotR); c.setAttribute('cy',cy); c.setAttribute('r',dotR); c.setAttribute('fill',item.color);
      svg.appendChild(c); x += dotR*2 + gap;
      const lt = document.createElementNS(NS,'text');
      lt.setAttribute('x',x); lt.setAttribute('y',cy);
      lt.setAttribute('dominant-baseline','middle'); lt.setAttribute('font-family',FONT);
      lt.setAttribute('font-size','11'); lt.setAttribute('font-weight','500'); lt.setAttribute('fill',fgColor);
      lt.textContent = item.label; svg.appendChild(lt);
      x += mc.measureText(item.label).width + pad;
    });
  }
  // Watermark text is baked to glyph outlines (WM_PATH) so the exported
  // SVG carries no editable/searchable string; renders identically.
  const wm = document.createElementNS(NS,'path');
  wm.setAttribute('d', WM_PATH);
  wm.setAttribute('transform', 'translate(' + (svgW-12-WM_PATH_W) + ',' + (svgH-12) + ')');
  wm.setAttribute('fill','#1a1a1a'); wm.setAttribute('opacity','0.22');
  svg.appendChild(wm);
  const wmLogoSize = 13;
  const wmTextW = WM_PATH_W;
  const wmLogo = document.createElementNS(NS,'image');
  wmLogo.setAttribute('href', WM_LOGO_SRC);
  wmLogo.setAttributeNS(xl,'href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize);
  wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', svgW - 12 - wmTextW - 4 - wmLogoSize);
  wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  svg.appendChild(wmLogo);
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = opts.filename || 'rent_vs_own_chart.svg';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ──────────────────────────────────────────────────────────────────────────
   COMPARISON CHART (Chart.js line chart of Own vs Rent over time). Used by the
   sensitivity scenario popup; mirrors the styling of the main tool's chart.
     opts: { labels:[year...], series:[{label,data,color}], yAxisTitle, sym }
   ────────────────────────────────────────────────────────────────────────── */
function chartCurrency(v, sym){
  sym = sym || '$';
  const n = Number(v||0), abs = Math.abs(n), sign = n<0 ? '−' : '';
  if(abs>=1e9) return sign+sym+(abs/1e9).toFixed(2)+'b';
  if(abs>=1e6) return sign+sym+(abs/1e6).toFixed(2)+'m';
  if(abs>=1000) return sign+sym+(abs/1000).toFixed(0)+'k';
  return sign+sym+Math.round(abs);
}

function renderComparisonChart(canvas, opts){
  opts = opts || {};
  if(!canvas || !global.Chart) return null;
  const sym = opts.sym || '$';
  const g = cssVar('--chart-grid'), m = cssVar('--chart-text'), t = cssVar('--text');
  const labels = opts.labels || [];
  const datasets = (opts.series || []).map(s=>({
    label: s.label,
    data: s.data,
    borderColor: s.color,
    backgroundColor: s.color + '22',
    borderWidth: 2.5,
    borderDash: (s.dash && s.dash.length) ? s.dash : undefined,
    pointRadius: 0,
    pointHoverRadius: 6,
    tension: 0.3,
    fill: false,
  }));
  const xTickCallback = function(val, i){
    const lbl = this.chart.data.labels[i];
    return (lbl !== undefined && lbl !== null) ? `Yr ${lbl}` : '';
  };
  return new global.Chart(canvas.getContext('2d'), {
    type:'line', data:{labels, datasets},
    options:{
      responsive:true, maintainAspectRatio:false, animation:{duration:200},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title: ctx=>`Year ${ctx[0].label}`,
            label: ctx=>`  ${ctx.dataset.label}: ${chartCurrency(ctx.parsed.y, sym)}`,
          },
          backgroundColor:cssVar('--panel')||'#162033',
          titleColor:t, bodyColor:m, borderColor:cssVar('--border'), borderWidth:1, padding:10,
        },
        zoom: global.Chart.registry && global.Chart.registry.plugins.get('zoom') ? {
          pan:{enabled:true,mode:'x'},
          zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'},
        } : undefined,
      },
      scales:{
        x:{title:{display:true,text:'Year',color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,maxTicksLimit:12,font:{family:"'DM Mono', monospace",size:11},callback:xTickCallback},grid:{color:g}},
        y:{title:{display:true,text:opts.yAxisTitle||'',color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,font:{family:"'DM Mono', monospace",size:11},callback:v=>chartCurrency(v, sym)},grid:{color:g}},
      },
    },
  });
}

global.RVOExport = {
  ownCashflowCSV, rentCashflowCSV, rtbCashflowCSV, downloadCSV, cleanCSV,
  exportChartPNG, exportChartSVG, copyChartPNG, renderComparisonChart,
};

})(window);
