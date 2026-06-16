'use strict';
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
// Watermark wordmark ("Made using tool.adjiebrotots.com/jsonvisualiser") baked to DM Sans 400 glyph
// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.
const WM_PATH = "M0.84 0V-7.7H1.92L4.58 -2.29L7.22 -7.7H8.31V0H7.39V-6.04L4.92 -1.04H4.23L1.76 -6.01V0ZM11.73 0.13Q11.07 0.13 10.62 -0.11Q10.18 -0.35 9.96 -0.76Q9.74 -1.16 9.74 -1.63Q9.74 -2.2 10.03 -2.59Q10.32 -2.99 10.85 -3.2Q11.38 -3.4 12.09 -3.4H13.54Q13.54 -3.95 13.4 -4.31Q13.26 -4.67 12.96 -4.86Q12.66 -5.04 12.18 -5.04Q11.68 -5.04 11.31 -4.78Q10.95 -4.53 10.86 -4.04H9.91Q9.98 -4.61 10.3 -5.01Q10.63 -5.41 11.13 -5.61Q11.63 -5.82 12.18 -5.82Q12.96 -5.82 13.47 -5.54Q13.97 -5.26 14.22 -4.76Q14.47 -4.26 14.47 -3.58V0H13.64L13.59 -0.99Q13.48 -0.76 13.31 -0.55Q13.14 -0.35 12.91 -0.2Q12.68 -0.04 12.39 0.04Q12.09 0.13 11.73 0.13ZM11.87 -0.65Q12.24 -0.65 12.55 -0.81Q12.86 -0.98 13.09 -1.25Q13.31 -1.53 13.43 -1.88Q13.54 -2.23 13.54 -2.61V-2.69H12.17Q11.65 -2.69 11.32 -2.56Q10.99 -2.43 10.85 -2.2Q10.71 -1.97 10.71 -1.67Q10.71 -1.36 10.84 -1.13Q10.98 -0.9 11.24 -0.78Q11.5 -0.65 11.87 -0.65ZM18.37 0.13Q17.58 0.13 16.99 -0.26Q16.39 -0.65 16.06 -1.32Q15.72 -2 15.72 -2.85Q15.72 -3.72 16.06 -4.38Q16.39 -5.05 16.99 -5.44Q17.59 -5.82 18.38 -5.82Q19.06 -5.82 19.56 -5.54Q20.06 -5.27 20.34 -4.77V-7.92H21.26V0H20.43L20.35 -0.92Q20.18 -0.65 19.91 -0.41Q19.64 -0.16 19.25 -0.02Q18.87 0.13 18.37 0.13ZM18.48 -0.67Q19.03 -0.67 19.44 -0.94Q19.86 -1.2 20.08 -1.69Q20.31 -2.18 20.31 -2.84Q20.31 -3.51 20.08 -3.99Q19.86 -4.48 19.44 -4.75Q19.03 -5.02 18.48 -5.02Q17.96 -5.02 17.55 -4.75Q17.13 -4.48 16.9 -3.99Q16.67 -3.51 16.67 -2.84Q16.67 -2.18 16.9 -1.69Q17.13 -1.2 17.55 -0.94Q17.96 -0.67 18.48 -0.67ZM25.22 0.13Q24.45 0.13 23.85 -0.24Q23.25 -0.61 22.92 -1.28Q22.58 -1.95 22.58 -2.84Q22.58 -3.74 22.91 -4.41Q23.25 -5.08 23.85 -5.45Q24.46 -5.82 25.24 -5.82Q26.07 -5.82 26.63 -5.45Q27.2 -5.08 27.49 -4.47Q27.78 -3.86 27.78 -3.13Q27.78 -3.02 27.78 -2.9Q27.78 -2.79 27.77 -2.63H23.27V-3.35H26.88Q26.85 -4.16 26.39 -4.6Q25.92 -5.04 25.22 -5.04Q24.76 -5.04 24.36 -4.82Q23.97 -4.6 23.72 -4.17Q23.48 -3.74 23.48 -3.1V-2.79Q23.48 -2.08 23.72 -1.6Q23.97 -1.12 24.36 -0.89Q24.76 -0.65 25.22 -0.65Q25.82 -0.65 26.19 -0.89Q26.55 -1.14 26.72 -1.58H27.63Q27.49 -1.09 27.17 -0.7Q26.84 -0.31 26.35 -0.09Q25.86 0.13 25.22 0.13ZM34.05 0.13Q33.41 0.13 32.93 -0.11Q32.46 -0.36 32.2 -0.87Q31.93 -1.38 31.93 -2.15V-5.69H32.86V-2.25Q32.86 -1.45 33.23 -1.06Q33.6 -0.66 34.25 -0.66Q34.7 -0.66 35.06 -0.87Q35.42 -1.08 35.64 -1.49Q35.85 -1.9 35.85 -2.49V-5.69H36.77V0H35.94L35.88 -0.94Q35.64 -0.43 35.16 -0.15Q34.67 0.13 34.05 0.13ZM40.42 0.13Q39.68 0.13 39.16 -0.1Q38.65 -0.33 38.37 -0.75Q38.09 -1.17 38.03 -1.74H38.98Q39.03 -1.44 39.19 -1.2Q39.36 -0.95 39.67 -0.8Q39.97 -0.65 40.43 -0.65Q40.81 -0.65 41.07 -0.76Q41.33 -0.88 41.46 -1.08Q41.59 -1.29 41.59 -1.55Q41.59 -1.9 41.43 -2.09Q41.27 -2.29 40.97 -2.39Q40.67 -2.49 40.22 -2.56Q39.78 -2.62 39.42 -2.74Q39.06 -2.86 38.79 -3.05Q38.53 -3.24 38.38 -3.52Q38.24 -3.81 38.24 -4.21Q38.24 -4.68 38.49 -5.04Q38.74 -5.41 39.2 -5.61Q39.66 -5.82 40.29 -5.82Q41.2 -5.82 41.75 -5.39Q42.3 -4.96 42.39 -4.16H41.48Q41.43 -4.57 41.12 -4.81Q40.8 -5.04 40.28 -5.04Q39.73 -5.04 39.45 -4.83Q39.17 -4.62 39.17 -4.28Q39.17 -4.04 39.31 -3.85Q39.44 -3.66 39.75 -3.53Q40.05 -3.4 40.53 -3.33Q41.14 -3.24 41.59 -3.07Q42.04 -2.91 42.29 -2.57Q42.55 -2.23 42.54 -1.62Q42.54 -1.07 42.28 -0.68Q42.01 -0.29 41.53 -0.08Q41.06 0.13 40.42 0.13ZM43.99 0V-5.69H44.91V0ZM44.45 -6.82Q44.17 -6.82 43.99 -7Q43.81 -7.18 43.81 -7.46Q43.81 -7.73 43.99 -7.9Q44.17 -8.07 44.45 -8.07Q44.71 -8.07 44.9 -7.9Q45.09 -7.73 45.09 -7.46Q45.09 -7.18 44.9 -7Q44.71 -6.82 44.45 -6.82ZM46.53 0V-5.69H47.37L47.42 -4.75Q47.67 -5.26 48.16 -5.54Q48.64 -5.82 49.27 -5.82Q49.91 -5.82 50.38 -5.57Q50.86 -5.33 51.12 -4.82Q51.38 -4.31 51.38 -3.54V0H50.46V-3.44Q50.46 -4.23 50.08 -4.63Q49.71 -5.03 49.06 -5.03Q48.62 -5.03 48.25 -4.82Q47.89 -4.6 47.67 -4.2Q47.46 -3.79 47.46 -3.2V0ZM55.11 2.55Q54.34 2.55 53.76 2.36Q53.17 2.17 52.85 1.77Q52.53 1.38 52.53 0.79Q52.53 0.53 52.63 0.23Q52.74 -0.06 52.99 -0.33Q53.25 -0.61 53.73 -0.83L54.4 -0.45Q53.8 -0.21 53.61 0.1Q53.43 0.42 53.43 0.7Q53.43 1.07 53.64 1.31Q53.85 1.55 54.23 1.67Q54.61 1.79 55.11 1.79Q55.59 1.79 55.94 1.66Q56.29 1.53 56.48 1.3Q56.68 1.06 56.68 0.73Q56.68 0.31 56.38 0.05Q56.09 -0.21 55.26 -0.26Q54.59 -0.3 54.15 -0.38Q53.7 -0.45 53.41 -0.56Q53.12 -0.66 52.93 -0.79Q52.74 -0.93 52.58 -1.07V-1.32L53.66 -2.37L54.51 -2.09L53.35 -1.1L53.49 -1.51Q53.62 -1.42 53.73 -1.34Q53.84 -1.27 54.03 -1.21Q54.22 -1.15 54.56 -1.1Q54.9 -1.05 55.47 -1Q56.24 -0.95 56.71 -0.74Q57.17 -0.53 57.38 -0.17Q57.59 0.19 57.59 0.7Q57.59 1.17 57.33 1.59Q57.07 2.01 56.52 2.28Q55.97 2.55 55.11 2.55ZM55.1 -1.78Q54.4 -1.78 53.91 -2.04Q53.42 -2.31 53.17 -2.77Q52.91 -3.23 52.91 -3.8Q52.91 -4.37 53.17 -4.82Q53.43 -5.28 53.91 -5.55Q54.4 -5.82 55.1 -5.82Q55.8 -5.82 56.29 -5.55Q56.77 -5.28 57.03 -4.82Q57.28 -4.37 57.28 -3.8Q57.28 -3.23 57.03 -2.77Q56.77 -2.31 56.29 -2.04Q55.8 -1.78 55.1 -1.78ZM55.1 -2.54Q55.7 -2.54 56.04 -2.85Q56.39 -3.17 56.39 -3.8Q56.39 -4.42 56.04 -4.73Q55.7 -5.05 55.1 -5.05Q54.51 -5.05 54.15 -4.73Q53.79 -4.42 53.79 -3.8Q53.79 -3.17 54.14 -2.85Q54.5 -2.54 55.1 -2.54ZM56.04 -4.91 55.76 -5.69H58.03V-4.99ZM64.28 0Q63.79 0 63.43 -0.15Q63.06 -0.31 62.87 -0.68Q62.68 -1.04 62.68 -1.67V-4.91H61.69V-5.69H62.68L62.8 -7.09H63.6V-5.69H65.23V-4.91H63.6V-1.67Q63.6 -1.16 63.81 -0.97Q64.02 -0.79 64.55 -0.79H65.19V0ZM68.95 0.13Q68.16 0.13 67.54 -0.24Q66.93 -0.6 66.58 -1.27Q66.24 -1.94 66.24 -2.84Q66.24 -3.75 66.59 -4.42Q66.94 -5.08 67.56 -5.45Q68.18 -5.82 68.97 -5.82Q69.78 -5.82 70.39 -5.45Q71 -5.08 71.35 -4.42Q71.69 -3.75 71.69 -2.84Q71.69 -1.94 71.34 -1.27Q70.99 -0.6 70.37 -0.24Q69.75 0.13 68.95 0.13ZM68.95 -0.66Q69.45 -0.66 69.86 -0.9Q70.26 -1.15 70.5 -1.63Q70.75 -2.12 70.75 -2.84Q70.75 -3.58 70.51 -4.06Q70.27 -4.54 69.87 -4.78Q69.47 -5.03 68.97 -5.03Q68.49 -5.03 68.08 -4.78Q67.67 -4.54 67.43 -4.06Q67.18 -3.57 67.18 -2.84Q67.18 -2.12 67.42 -1.63Q67.66 -1.15 68.07 -0.9Q68.47 -0.66 68.95 -0.66ZM75.51 0.13Q74.72 0.13 74.1 -0.24Q73.48 -0.6 73.14 -1.27Q72.79 -1.94 72.79 -2.84Q72.79 -3.75 73.14 -4.42Q73.49 -5.08 74.12 -5.45Q74.74 -5.82 75.53 -5.82Q76.33 -5.82 76.94 -5.45Q77.56 -5.08 77.9 -4.42Q78.25 -3.75 78.25 -2.84Q78.25 -1.94 77.9 -1.27Q77.54 -0.6 76.93 -0.24Q76.31 0.13 75.51 0.13ZM75.51 -0.66Q76 -0.66 76.41 -0.9Q76.82 -1.15 77.06 -1.63Q77.3 -2.12 77.3 -2.84Q77.3 -3.58 77.07 -4.06Q76.83 -4.54 76.43 -4.78Q76.02 -5.03 75.53 -5.03Q75.05 -5.03 74.64 -4.78Q74.23 -4.54 73.98 -4.06Q73.74 -3.57 73.74 -2.84Q73.74 -2.12 73.98 -1.63Q74.22 -1.15 74.62 -0.9Q75.02 -0.66 75.51 -0.66ZM79.58 0V-7.92H80.5V0ZM82.4 0.05Q82.14 0.05 81.95 -0.13Q81.77 -0.31 81.77 -0.57Q81.77 -0.84 81.95 -1.02Q82.14 -1.2 82.4 -1.2Q82.69 -1.2 82.86 -1.02Q83.03 -0.84 83.03 -0.57Q83.03 -0.31 82.86 -0.13Q82.69 0.05 82.4 0.05ZM86.1 0.13Q85.44 0.13 84.99 -0.11Q84.55 -0.35 84.33 -0.76Q84.11 -1.16 84.11 -1.63Q84.11 -2.2 84.4 -2.59Q84.69 -2.99 85.22 -3.2Q85.75 -3.4 86.46 -3.4H87.92Q87.92 -3.95 87.77 -4.31Q87.63 -4.67 87.33 -4.86Q87.03 -5.04 86.56 -5.04Q86.05 -5.04 85.68 -4.78Q85.32 -4.53 85.23 -4.04H84.28Q84.35 -4.61 84.67 -5.01Q85 -5.41 85.5 -5.61Q86 -5.82 86.56 -5.82Q87.33 -5.82 87.84 -5.54Q88.35 -5.26 88.59 -4.76Q88.84 -4.26 88.84 -3.58V0H88.01L87.96 -0.99Q87.85 -0.76 87.68 -0.55Q87.51 -0.35 87.28 -0.2Q87.05 -0.04 86.76 0.04Q86.46 0.13 86.1 0.13ZM86.24 -0.65Q86.61 -0.65 86.92 -0.81Q87.23 -0.98 87.46 -1.25Q87.68 -1.53 87.8 -1.88Q87.92 -2.23 87.92 -2.61V-2.69H86.54Q86.02 -2.69 85.69 -2.56Q85.37 -2.43 85.22 -2.2Q85.08 -1.97 85.08 -1.67Q85.08 -1.36 85.21 -1.13Q85.35 -0.9 85.61 -0.78Q85.87 -0.65 86.24 -0.65ZM92.74 0.13Q91.96 0.13 91.36 -0.26Q90.76 -0.65 90.43 -1.32Q90.09 -2 90.09 -2.85Q90.09 -3.72 90.43 -4.38Q90.76 -5.05 91.36 -5.44Q91.96 -5.82 92.75 -5.82Q93.43 -5.82 93.93 -5.54Q94.43 -5.27 94.71 -4.77V-7.92H95.63V0H94.8L94.72 -0.92Q94.55 -0.65 94.28 -0.41Q94.01 -0.16 93.63 -0.02Q93.24 0.13 92.74 0.13ZM92.85 -0.67Q93.4 -0.67 93.82 -0.94Q94.23 -1.2 94.45 -1.69Q94.68 -2.18 94.68 -2.84Q94.68 -3.51 94.45 -3.99Q94.23 -4.48 93.82 -4.75Q93.4 -5.02 92.85 -5.02Q92.33 -5.02 91.92 -4.75Q91.51 -4.48 91.27 -3.99Q91.04 -3.51 91.04 -2.84Q91.04 -2.18 91.27 -1.69Q91.51 -1.2 91.92 -0.94Q92.33 -0.67 92.85 -0.67ZM96.11 2.42V1.63H96.54Q96.96 1.63 97.13 1.46Q97.31 1.29 97.31 0.88V-5.69H98.23V0.9Q98.23 1.43 98.06 1.77Q97.88 2.1 97.54 2.26Q97.19 2.42 96.68 2.42ZM97.78 -6.82Q97.51 -6.82 97.33 -7Q97.15 -7.18 97.15 -7.46Q97.15 -7.73 97.33 -7.9Q97.51 -8.07 97.78 -8.07Q98.05 -8.07 98.23 -7.9Q98.41 -7.73 98.41 -7.46Q98.41 -7.18 98.23 -7Q98.05 -6.82 97.78 -6.82ZM99.94 0V-5.69H100.87V0ZM100.4 -6.82Q100.13 -6.82 99.95 -7Q99.77 -7.18 99.77 -7.46Q99.77 -7.73 99.95 -7.9Q100.13 -8.07 100.4 -8.07Q100.67 -8.07 100.86 -7.9Q101.04 -7.73 101.04 -7.46Q101.04 -7.18 100.86 -7Q100.67 -6.82 100.4 -6.82ZM104.91 0.13Q104.13 0.13 103.54 -0.24Q102.94 -0.61 102.6 -1.28Q102.26 -1.95 102.26 -2.84Q102.26 -3.74 102.6 -4.41Q102.93 -5.08 103.54 -5.45Q104.14 -5.82 104.93 -5.82Q105.75 -5.82 106.32 -5.45Q106.88 -5.08 107.18 -4.47Q107.47 -3.86 107.47 -3.13Q107.47 -3.02 107.47 -2.9Q107.47 -2.79 107.46 -2.63H102.95V-3.35H106.56Q106.54 -4.16 106.07 -4.6Q105.6 -5.04 104.91 -5.04Q104.44 -5.04 104.05 -4.82Q103.65 -4.6 103.41 -4.17Q103.16 -3.74 103.16 -3.1V-2.79Q103.16 -2.08 103.41 -1.6Q103.65 -1.12 104.05 -0.89Q104.44 -0.65 104.91 -0.65Q105.51 -0.65 105.87 -0.89Q106.23 -1.14 106.4 -1.58H107.31Q107.18 -1.09 106.85 -0.7Q106.53 -0.31 106.04 -0.09Q105.55 0.13 104.91 0.13ZM111.62 0.13Q111.12 0.13 110.74 -0.02Q110.36 -0.17 110.09 -0.41Q109.82 -0.64 109.64 -0.91L109.56 0H108.73V-7.92H109.65V-4.78Q109.92 -5.26 110.43 -5.54Q110.93 -5.82 111.61 -5.82Q112.41 -5.82 113 -5.44Q113.6 -5.06 113.93 -4.39Q114.26 -3.72 114.26 -2.86Q114.26 -2 113.93 -1.32Q113.6 -0.64 113.01 -0.26Q112.41 0.13 111.62 0.13ZM111.51 -0.67Q112.03 -0.67 112.44 -0.94Q112.85 -1.2 113.09 -1.69Q113.32 -2.18 113.32 -2.84Q113.32 -3.51 113.09 -3.99Q112.85 -4.48 112.44 -4.75Q112.03 -5.02 111.51 -5.02Q110.96 -5.02 110.54 -4.75Q110.13 -4.48 109.91 -3.99Q109.68 -3.51 109.68 -2.84Q109.68 -2.18 109.91 -1.69Q110.13 -1.2 110.54 -0.94Q110.96 -0.67 111.51 -0.67ZM115.59 0V-5.69H116.43L116.5 -4.63Q116.69 -5.02 117 -5.28Q117.31 -5.55 117.75 -5.68Q118.18 -5.82 118.74 -5.82V-4.85H118.26Q117.92 -4.85 117.61 -4.76Q117.29 -4.67 117.05 -4.47Q116.8 -4.27 116.66 -3.92Q116.52 -3.57 116.52 -3.05V0ZM122.28 0.13Q121.49 0.13 120.87 -0.24Q120.26 -0.6 119.91 -1.27Q119.56 -1.94 119.56 -2.84Q119.56 -3.75 119.91 -4.42Q120.27 -5.08 120.89 -5.45Q121.51 -5.82 122.3 -5.82Q123.1 -5.82 123.72 -5.45Q124.33 -5.08 124.67 -4.42Q125.02 -3.75 125.02 -2.84Q125.02 -1.94 124.67 -1.27Q124.32 -0.6 123.7 -0.24Q123.08 0.13 122.28 0.13ZM122.28 -0.66Q122.78 -0.66 123.18 -0.9Q123.59 -1.15 123.83 -1.63Q124.07 -2.12 124.07 -2.84Q124.07 -3.58 123.84 -4.06Q123.6 -4.54 123.2 -4.78Q122.8 -5.03 122.3 -5.03Q121.82 -5.03 121.41 -4.78Q121 -4.54 120.75 -4.06Q120.51 -3.57 120.51 -2.84Q120.51 -2.12 120.75 -1.63Q120.99 -1.15 121.39 -0.9Q121.8 -0.66 122.28 -0.66ZM128.57 0Q128.07 0 127.71 -0.15Q127.35 -0.31 127.15 -0.68Q126.96 -1.04 126.96 -1.67V-4.91H125.97V-5.69H126.96L127.08 -7.09H127.89V-5.69H129.52V-4.91H127.89V-1.67Q127.89 -1.16 128.1 -0.97Q128.3 -0.79 128.83 -0.79H129.47V0ZM133.23 0.13Q132.44 0.13 131.83 -0.24Q131.21 -0.6 130.87 -1.27Q130.52 -1.94 130.52 -2.84Q130.52 -3.75 130.87 -4.42Q131.22 -5.08 131.84 -5.45Q132.47 -5.82 133.26 -5.82Q134.06 -5.82 134.67 -5.45Q135.28 -5.08 135.63 -4.42Q135.98 -3.75 135.98 -2.84Q135.98 -1.94 135.62 -1.27Q135.27 -0.6 134.65 -0.24Q134.04 0.13 133.23 0.13ZM133.24 -0.66Q133.73 -0.66 134.14 -0.9Q134.55 -1.15 134.79 -1.63Q135.03 -2.12 135.03 -2.84Q135.03 -3.58 134.79 -4.06Q134.56 -4.54 134.15 -4.78Q133.75 -5.03 133.26 -5.03Q132.77 -5.03 132.36 -4.78Q131.96 -4.54 131.71 -4.06Q131.47 -3.57 131.47 -2.84Q131.47 -2.12 131.71 -1.63Q131.95 -1.15 132.35 -0.9Q132.75 -0.66 133.24 -0.66ZM139.52 0Q139.03 0 138.67 -0.15Q138.3 -0.31 138.11 -0.68Q137.92 -1.04 137.92 -1.67V-4.91H136.93V-5.69H137.92L138.04 -7.09H138.84V-5.69H140.47V-4.91H138.84V-1.67Q138.84 -1.16 139.05 -0.97Q139.26 -0.79 139.79 -0.79H140.43V0ZM143.8 0.13Q143.05 0.13 142.54 -0.1Q142.03 -0.33 141.75 -0.75Q141.47 -1.17 141.41 -1.74H142.36Q142.41 -1.44 142.57 -1.2Q142.74 -0.95 143.04 -0.8Q143.35 -0.65 143.81 -0.65Q144.19 -0.65 144.45 -0.76Q144.71 -0.88 144.84 -1.08Q144.97 -1.29 144.97 -1.55Q144.97 -1.9 144.81 -2.09Q144.65 -2.29 144.35 -2.39Q144.04 -2.49 143.6 -2.56Q143.16 -2.62 142.8 -2.74Q142.43 -2.86 142.17 -3.05Q141.9 -3.24 141.76 -3.52Q141.62 -3.81 141.62 -4.21Q141.62 -4.68 141.87 -5.04Q142.12 -5.41 142.58 -5.61Q143.04 -5.82 143.67 -5.82Q144.58 -5.82 145.13 -5.39Q145.68 -4.96 145.77 -4.16H144.86Q144.81 -4.57 144.49 -4.81Q144.18 -5.04 143.65 -5.04Q143.11 -5.04 142.83 -4.83Q142.55 -4.62 142.55 -4.28Q142.55 -4.04 142.69 -3.85Q142.82 -3.66 143.12 -3.53Q143.43 -3.4 143.91 -3.33Q144.52 -3.24 144.97 -3.07Q145.42 -2.91 145.67 -2.57Q145.92 -2.23 145.92 -1.62Q145.92 -1.07 145.65 -0.68Q145.39 -0.29 144.91 -0.08Q144.44 0.13 143.8 0.13ZM147.62 0.05Q147.35 0.05 147.17 -0.13Q146.99 -0.31 146.99 -0.57Q146.99 -0.84 147.17 -1.02Q147.35 -1.2 147.62 -1.2Q147.9 -1.2 148.08 -1.02Q148.25 -0.84 148.25 -0.57Q148.25 -0.31 148.08 -0.13Q147.9 0.05 147.62 0.05ZM152.02 0.13Q151.23 0.13 150.61 -0.24Q149.99 -0.61 149.64 -1.28Q149.29 -1.96 149.29 -2.84Q149.29 -3.74 149.64 -4.41Q149.99 -5.07 150.61 -5.45Q151.23 -5.82 152.02 -5.82Q153 -5.82 153.67 -5.3Q154.33 -4.78 154.51 -3.9H153.57Q153.45 -4.44 153.02 -4.73Q152.59 -5.03 152.01 -5.03Q151.51 -5.03 151.11 -4.78Q150.71 -4.53 150.47 -4.05Q150.23 -3.57 150.23 -2.84Q150.23 -2.31 150.37 -1.89Q150.51 -1.48 150.75 -1.2Q150.98 -0.93 151.31 -0.79Q151.63 -0.65 152.01 -0.65Q152.4 -0.65 152.72 -0.78Q153.04 -0.92 153.27 -1.17Q153.49 -1.43 153.57 -1.79H154.51Q154.34 -0.93 153.67 -0.4Q153 0.13 152.02 0.13ZM158.33 0.13Q157.53 0.13 156.92 -0.24Q156.3 -0.6 155.96 -1.27Q155.61 -1.94 155.61 -2.84Q155.61 -3.75 155.96 -4.42Q156.31 -5.08 156.93 -5.45Q157.56 -5.82 158.35 -5.82Q159.15 -5.82 159.76 -5.45Q160.37 -5.08 160.72 -4.42Q161.07 -3.75 161.07 -2.84Q161.07 -1.94 160.71 -1.27Q160.36 -0.6 159.75 -0.24Q159.13 0.13 158.33 0.13ZM158.33 -0.66Q158.82 -0.66 159.23 -0.9Q159.64 -1.15 159.88 -1.63Q160.12 -2.12 160.12 -2.84Q160.12 -3.58 159.88 -4.06Q159.65 -4.54 159.25 -4.78Q158.84 -5.03 158.35 -5.03Q157.86 -5.03 157.46 -4.78Q157.05 -4.54 156.8 -4.06Q156.56 -3.57 156.56 -2.84Q156.56 -2.12 156.8 -1.63Q157.04 -1.15 157.44 -0.9Q157.84 -0.66 158.33 -0.66ZM162.4 0V-5.69H163.23L163.28 -4.9Q163.55 -5.33 164 -5.57Q164.44 -5.82 164.95 -5.82Q165.38 -5.82 165.72 -5.7Q166.06 -5.59 166.32 -5.35Q166.57 -5.12 166.73 -4.76Q167.02 -5.27 167.51 -5.55Q168.01 -5.82 168.55 -5.82Q169.2 -5.82 169.66 -5.57Q170.12 -5.32 170.38 -4.81Q170.63 -4.3 170.63 -3.53V0H169.72V-3.43Q169.72 -4.23 169.38 -4.63Q169.03 -5.03 168.44 -5.03Q168.03 -5.03 167.69 -4.81Q167.36 -4.6 167.17 -4.18Q166.98 -3.77 166.98 -3.17V0H166.05V-3.43Q166.05 -4.23 165.71 -4.63Q165.37 -5.03 164.78 -5.03Q164.38 -5.03 164.05 -4.81Q163.72 -4.6 163.52 -4.18Q163.32 -3.77 163.32 -3.17V0ZM171.66 1.04 174.42 -8.4H175.34L172.58 1.04ZM175.37 2.42V1.63H175.8Q176.21 1.63 176.39 1.46Q176.57 1.29 176.57 0.88V-5.69H177.49V0.9Q177.49 1.43 177.31 1.77Q177.14 2.1 176.79 2.26Q176.44 2.42 175.94 2.42ZM177.04 -6.82Q176.76 -6.82 176.58 -7Q176.4 -7.18 176.4 -7.46Q176.4 -7.73 176.58 -7.9Q176.76 -8.07 177.04 -8.07Q177.3 -8.07 177.48 -7.9Q177.67 -7.73 177.67 -7.46Q177.67 -7.18 177.48 -7Q177.3 -6.82 177.04 -6.82ZM181.2 0.13Q180.45 0.13 179.94 -0.1Q179.43 -0.33 179.15 -0.75Q178.87 -1.17 178.81 -1.74H179.76Q179.81 -1.44 179.97 -1.2Q180.14 -0.95 180.44 -0.8Q180.75 -0.65 181.21 -0.65Q181.59 -0.65 181.85 -0.76Q182.11 -0.88 182.24 -1.08Q182.37 -1.29 182.37 -1.55Q182.37 -1.9 182.21 -2.09Q182.05 -2.29 181.75 -2.39Q181.44 -2.49 181 -2.56Q180.56 -2.62 180.2 -2.74Q179.83 -2.86 179.57 -3.05Q179.3 -3.24 179.16 -3.52Q179.02 -3.81 179.02 -4.21Q179.02 -4.68 179.27 -5.04Q179.52 -5.41 179.98 -5.61Q180.44 -5.82 181.07 -5.82Q181.98 -5.82 182.53 -5.39Q183.08 -4.96 183.17 -4.16H182.26Q182.21 -4.57 181.89 -4.81Q181.58 -5.04 181.05 -5.04Q180.51 -5.04 180.23 -4.83Q179.95 -4.62 179.95 -4.28Q179.95 -4.04 180.09 -3.85Q180.22 -3.66 180.52 -3.53Q180.83 -3.4 181.31 -3.33Q181.92 -3.24 182.37 -3.07Q182.82 -2.91 183.07 -2.57Q183.32 -2.23 183.32 -1.62Q183.32 -1.07 183.05 -0.68Q182.79 -0.29 182.31 -0.08Q181.84 0.13 181.2 0.13ZM187.16 0.13Q186.37 0.13 185.75 -0.24Q185.13 -0.6 184.79 -1.27Q184.44 -1.94 184.44 -2.84Q184.44 -3.75 184.79 -4.42Q185.14 -5.08 185.77 -5.45Q186.39 -5.82 187.18 -5.82Q187.98 -5.82 188.59 -5.45Q189.21 -5.08 189.55 -4.42Q189.9 -3.75 189.9 -2.84Q189.9 -1.94 189.55 -1.27Q189.19 -0.6 188.58 -0.24Q187.96 0.13 187.16 0.13ZM187.16 -0.66Q187.65 -0.66 188.06 -0.9Q188.47 -1.15 188.71 -1.63Q188.95 -2.12 188.95 -2.84Q188.95 -3.58 188.72 -4.06Q188.48 -4.54 188.08 -4.78Q187.67 -5.03 187.18 -5.03Q186.7 -5.03 186.29 -4.78Q185.88 -4.54 185.63 -4.06Q185.39 -3.57 185.39 -2.84Q185.39 -2.12 185.63 -1.63Q185.87 -1.15 186.27 -0.9Q186.67 -0.66 187.16 -0.66ZM191.23 0V-5.69H192.06L192.11 -4.75Q192.37 -5.26 192.85 -5.54Q193.33 -5.82 193.96 -5.82Q194.6 -5.82 195.08 -5.57Q195.55 -5.33 195.81 -4.82Q196.08 -4.31 196.08 -3.54V0H195.15V-3.44Q195.15 -4.23 194.78 -4.63Q194.4 -5.03 193.75 -5.03Q193.31 -5.03 192.95 -4.82Q192.58 -4.6 192.37 -4.2Q192.15 -3.79 192.15 -3.2V0ZM199.21 0 197.05 -5.69H198.03L199.75 -0.89L201.49 -5.69H202.43L200.28 0ZM203.56 0V-5.69H204.49V0ZM204.02 -6.82Q203.75 -6.82 203.57 -7Q203.39 -7.18 203.39 -7.46Q203.39 -7.73 203.57 -7.9Q203.75 -8.07 204.02 -8.07Q204.29 -8.07 204.48 -7.9Q204.66 -7.73 204.66 -7.46Q204.66 -7.18 204.48 -7Q204.29 -6.82 204.02 -6.82ZM208.2 0.13Q207.46 0.13 206.95 -0.1Q206.43 -0.33 206.15 -0.75Q205.88 -1.17 205.81 -1.74H206.76Q206.81 -1.44 206.98 -1.2Q207.14 -0.95 207.45 -0.8Q207.76 -0.65 208.21 -0.65Q208.59 -0.65 208.85 -0.76Q209.11 -0.88 209.24 -1.08Q209.38 -1.29 209.38 -1.55Q209.38 -1.9 209.22 -2.09Q209.06 -2.29 208.75 -2.39Q208.45 -2.49 208 -2.56Q207.57 -2.62 207.2 -2.74Q206.84 -2.86 206.57 -3.05Q206.31 -3.24 206.16 -3.52Q206.02 -3.81 206.02 -4.21Q206.02 -4.68 206.27 -5.04Q206.52 -5.41 206.98 -5.61Q207.44 -5.82 208.07 -5.82Q208.99 -5.82 209.53 -5.39Q210.08 -4.96 210.18 -4.16H209.26Q209.21 -4.57 208.9 -4.81Q208.58 -5.04 208.06 -5.04Q207.52 -5.04 207.24 -4.83Q206.96 -4.62 206.96 -4.28Q206.96 -4.04 207.09 -3.85Q207.23 -3.66 207.53 -3.53Q207.83 -3.4 208.31 -3.33Q208.92 -3.24 209.37 -3.07Q209.82 -2.91 210.08 -2.57Q210.33 -2.23 210.32 -1.62Q210.33 -1.07 210.06 -0.68Q209.79 -0.29 209.32 -0.08Q208.84 0.13 208.2 0.13ZM213.73 0.13Q213.09 0.13 212.62 -0.11Q212.14 -0.36 211.88 -0.87Q211.62 -1.38 211.62 -2.15V-5.69H212.54V-2.25Q212.54 -1.45 212.91 -1.06Q213.29 -0.66 213.94 -0.66Q214.39 -0.66 214.75 -0.87Q215.11 -1.08 215.32 -1.49Q215.54 -1.9 215.54 -2.49V-5.69H216.46V0H215.62L215.57 -0.94Q215.33 -0.43 214.84 -0.15Q214.36 0.13 213.73 0.13ZM219.82 0.13Q219.15 0.13 218.71 -0.11Q218.27 -0.35 218.05 -0.76Q217.83 -1.16 217.83 -1.63Q217.83 -2.2 218.12 -2.59Q218.41 -2.99 218.94 -3.2Q219.47 -3.4 220.18 -3.4H221.63Q221.63 -3.95 221.49 -4.31Q221.35 -4.67 221.05 -4.86Q220.75 -5.04 220.27 -5.04Q219.76 -5.04 219.4 -4.78Q219.03 -4.53 218.95 -4.04H218Q218.07 -4.61 218.39 -5.01Q218.72 -5.41 219.22 -5.61Q219.72 -5.82 220.27 -5.82Q221.05 -5.82 221.55 -5.54Q222.06 -5.26 222.31 -4.76Q222.56 -4.26 222.56 -3.58V0H221.73L221.68 -0.99Q221.57 -0.76 221.39 -0.55Q221.22 -0.35 220.99 -0.2Q220.77 -0.04 220.47 0.04Q220.18 0.13 219.82 0.13ZM219.96 -0.65Q220.33 -0.65 220.64 -0.81Q220.95 -0.98 221.17 -1.25Q221.4 -1.53 221.51 -1.88Q221.63 -2.23 221.63 -2.61V-2.69H220.26Q219.73 -2.69 219.41 -2.56Q219.08 -2.43 218.94 -2.2Q218.8 -1.97 218.8 -1.67Q218.8 -1.36 218.93 -1.13Q219.06 -0.9 219.32 -0.78Q219.59 -0.65 219.96 -0.65ZM224.04 0V-7.92H224.97V0ZM226.61 0V-5.69H227.53V0ZM227.07 -6.82Q226.79 -6.82 226.61 -7Q226.43 -7.18 226.43 -7.46Q226.43 -7.73 226.61 -7.9Q226.79 -8.07 227.07 -8.07Q227.33 -8.07 227.52 -7.9Q227.71 -7.73 227.71 -7.46Q227.71 -7.18 227.52 -7Q227.33 -6.82 227.07 -6.82ZM231.25 0.13Q230.5 0.13 229.99 -0.1Q229.48 -0.33 229.2 -0.75Q228.92 -1.17 228.86 -1.74H229.81Q229.86 -1.44 230.02 -1.2Q230.19 -0.95 230.49 -0.8Q230.8 -0.65 231.26 -0.65Q231.64 -0.65 231.9 -0.76Q232.16 -0.88 232.29 -1.08Q232.42 -1.29 232.42 -1.55Q232.42 -1.9 232.26 -2.09Q232.1 -2.29 231.8 -2.39Q231.49 -2.49 231.05 -2.56Q230.61 -2.62 230.25 -2.74Q229.88 -2.86 229.62 -3.05Q229.35 -3.24 229.21 -3.52Q229.07 -3.81 229.07 -4.21Q229.07 -4.68 229.32 -5.04Q229.57 -5.41 230.03 -5.61Q230.49 -5.82 231.12 -5.82Q232.03 -5.82 232.58 -5.39Q233.13 -4.96 233.22 -4.16H232.31Q232.26 -4.57 231.94 -4.81Q231.63 -5.04 231.1 -5.04Q230.56 -5.04 230.28 -4.83Q230 -4.62 230 -4.28Q230 -4.04 230.14 -3.85Q230.27 -3.66 230.57 -3.53Q230.88 -3.4 231.36 -3.33Q231.97 -3.24 232.42 -3.07Q232.87 -2.91 233.12 -2.57Q233.37 -2.23 233.37 -1.62Q233.37 -1.07 233.1 -0.68Q232.84 -0.29 232.36 -0.08Q231.89 0.13 231.25 0.13ZM237.14 0.13Q236.36 0.13 235.77 -0.24Q235.17 -0.61 234.83 -1.28Q234.49 -1.95 234.49 -2.84Q234.49 -3.74 234.83 -4.41Q235.17 -5.08 235.77 -5.45Q236.37 -5.82 237.16 -5.82Q237.99 -5.82 238.55 -5.45Q239.11 -5.08 239.41 -4.47Q239.7 -3.86 239.7 -3.13Q239.7 -3.02 239.7 -2.9Q239.7 -2.79 239.69 -2.63H235.18V-3.35H238.79Q238.77 -4.16 238.3 -4.6Q237.83 -5.04 237.14 -5.04Q236.67 -5.04 236.28 -4.82Q235.88 -4.6 235.64 -4.17Q235.39 -3.74 235.39 -3.1V-2.79Q235.39 -2.08 235.64 -1.6Q235.88 -1.12 236.28 -0.89Q236.67 -0.65 237.14 -0.65Q237.74 -0.65 238.1 -0.89Q238.46 -1.14 238.63 -1.58H239.54Q239.41 -1.09 239.08 -0.7Q238.76 -0.31 238.27 -0.09Q237.78 0.13 237.14 0.13ZM240.96 0V-5.69H241.8L241.86 -4.63Q242.06 -5.02 242.37 -5.28Q242.67 -5.55 243.11 -5.68Q243.55 -5.82 244.1 -5.82V-4.85H243.63Q243.29 -4.85 242.97 -4.76Q242.66 -4.67 242.41 -4.47Q242.17 -4.27 242.02 -3.92Q241.88 -3.57 241.88 -3.05V0Z";
const WM_PATH_W = 244.39;
const EXPORT_WATERMARK_TEXT = 'Made using tool.adjiebrotots.com/jsonvisualiser';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }
// ─── STATE ───────────────────────────────────────────────────────────────────
let parsedData = null;
let currentFileName = '';
let currentFileSize = 0;
let nodeIdCounter = 0;
let rootDescriptor = null;

// ─── UTILS ───────────────────────────────────────────────────────────────────
function $(id){ return document.getElementById(id); }

function setLoadMethodMode(activeMethod){
  const inputs = $('loadInputs');
  if(!inputs) return;
  inputs.classList.toggle('has-selection', Boolean(activeMethod));
  inputs.querySelectorAll('.load-method').forEach(section => {
    section.classList.toggle('active', section.dataset.loadMethod === activeMethod);
  });
}

function expandLoadMethod(method){
  if(!method) return;
  setLoadMethodMode(method);
}

function getType(val){
  if(val === null) return 'null';
  if(Array.isArray(val)) return 'array';
  return typeof val;
}
function isPrimitive(type){ return type==='string'||type==='number'||type==='boolean'||type==='null'; }
function hasIndexKey(key){ return key !== null && /^\d+$/.test(String(key)); }

function formatPreviewValue(value, type){
  if(type === 'string'){
    const preview = value.length > 80 ? value.slice(0, 80) + '…' : value;
    return JSON.stringify(preview);
  }
  if(type === 'number' || type === 'boolean' || type === 'null') return JSON.stringify(value);
  if(type === 'array') return `[${value.length}]`;
  if(type === 'object') return `{${Object.keys(value).length}}`;
  return String(value);
}

function getBranchPreview(desc){
  // Numeric/indexed object nodes are the only branches that lack their own
  // meaningful label. Give those collapsed nodes context by borrowing the first
  // child entry, but keep named branches (e.g. ElmPvsys) unchanged.
  if(!hasIndexKey(desc.key) || desc.type !== 'object' || desc.rawRef === null) return null;
  const firstKey = desc.childKeys && desc.childKeys[0];
  if(firstKey === undefined) return null;
  const firstValue = desc.rawRef[firstKey];
  return { key: firstKey, value: formatPreviewValue(firstValue, getType(firstValue)) };
}

function appendBranchPreview(node, preview){
  if(!preview) return null;
  const wrapper = document.createElement('span');
  wrapper.className = 'node-preview';

  const keySpan = document.createElement('span');
  keySpan.className = 'node-preview-key';
  keySpan.textContent = preview.key;
  wrapper.appendChild(keySpan);

  const colon = document.createElement('span');
  colon.className = 'node-colon';
  colon.textContent = ':';
  wrapper.appendChild(colon);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'node-preview-value';
  valueSpan.textContent = preview.value;
  wrapper.appendChild(valueSpan);

  node.appendChild(wrapper);
  return wrapper;
}

function syncBranchPreviewState(nodeEl){
  if(!nodeEl.classList.contains('has-preview')) return;
  const isExpanded = nodeEl.classList.contains('is-expanded');
  const previewEl = nodeEl.querySelector('.node-preview');
  const colonEl = nodeEl.querySelector('.node-key-colon');
  if(previewEl) previewEl.hidden = isExpanded;
  if(colonEl) colonEl.hidden = !isExpanded;
}

function syncBranchPreviewStates(rootEl = document){
  rootEl.querySelectorAll('.tj-node.has-preview').forEach(syncBranchPreviewState);
}

function getVisibleNodeText(nodeEl){
  return [...nodeEl.childNodes].reduce((parts, child) => {
    if(child.nodeType === Node.TEXT_NODE) return parts + child.textContent;
    if(child.nodeType !== Node.ELEMENT_NODE) return parts;
    if(child.hidden) return parts;
    const style = window.getComputedStyle(child);
    if(style.display === 'none' || style.visibility === 'hidden') return parts;
    if(child.classList.contains('node-toggle')) return parts;
    return parts + child.textContent;
  }, '').replace(/\s+/g, ' ').trim();
}

function formatBytes(b){
  if(b < 1024) return b+' B';
  if(b < 1024*1024) return (b/1024).toFixed(1)+' KB';
  return (b/(1024*1024)).toFixed(2)+' MB';
}

function countDepth(val, d=0){
  if(d > 20) return d; // cap for perf
  if(val === null || typeof val !== 'object') return d;
  const children = Array.isArray(val) ? val.slice(0,5) : Object.values(val).slice(0,10);
  return children.reduce((max, c) => Math.max(max, countDepth(c, d+1)), d);
}

function countNodes(val, d=0){
  if(d > 8) return 1; // cap recursion for perf
  if(val === null || typeof val !== 'object') return 1;
  const entries = Array.isArray(val) ? val.slice(0,100) : Object.values(val).slice(0,100);
  return 1 + entries.reduce((s,c) => s + countNodes(c, d+1), 0);
}

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────
function showStatus(id, msg){
  ['statusLoading','statusSuccess','statusError'].forEach(s => {
    const el = $(s);
    el.classList.remove('visible');
    el.textContent = '';
  });
  const el = $(id);
  if(el){ el.textContent = msg; el.classList.add('visible'); }
}
function hideStatus(){
  ['statusLoading','statusSuccess','statusError'].forEach(s => {
    $(s).classList.remove('visible');
  });
}

// ─── THEME TOGGLE ────────────────────────────────────────────────────────────
const themeBtn = $('themeToggle');
themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  themeBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('jv-theme', isDark ? 'dark' : 'light');
});
(function initTheme(){
  const saved = localStorage.getItem('jv-theme');
  if(saved === 'dark'){ document.body.classList.add('dark'); themeBtn.textContent = '☀️ Light'; }
})();

// ─── DROP ZONE & FILE INPUT ──────────────────────────────────────────────────
const dropZone = $('dropZone');
const fileInput = $('fileInput');

document.querySelectorAll('[data-method-toggle]').forEach(btn => {
  btn.addEventListener('click', () => expandLoadMethod(btn.dataset.methodToggle));
});

$('browseBtn').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => { if(e.key==='Enter'||e.key===' ') fileInput.click(); });

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if(file) loadFile(file);
});

fileInput.addEventListener('change', () => {
  if(fileInput.files[0]) loadFile(fileInput.files[0]);
  fileInput.value = '';
});

function loadFile(file){
  currentFileName = file.name;
  currentFileSize = file.size;
  showLoading('Reading file...');
  const reader = new FileReader();
  reader.onload = (e) => handleRawJSON(e.target.result, file.name, file.size, 'file');
  reader.onerror = () => showError('Failed to read file.');
  reader.readAsText(file);
}

// ─── URL FETCH ───────────────────────────────────────────────────────────────
$('fetchBtn').addEventListener('click', () => {
  const url = $('urlInput').value.trim();
  if(!url){ showStatus('statusError','Please enter a URL.'); return; }
  showLoading('Fetching...');
  fetch(url)
    .then(r => {
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(text => {
      const name = url.split('/').pop().split('?')[0] || 'fetched.json';
      handleRawJSON(text, name, text.length, 'url');
    })
    .catch(err => showError('Fetch failed: ' + err.message + '. Check CORS headers on the target server.'));
});

$('urlInput').addEventListener('keydown', (e) => { if(e.key==='Enter') $('fetchBtn').click(); });

// ─── DIRECT JSON PASTE ───────────────────────────────────────────────────────
$('loadTextBtn').addEventListener('click', () => {
  const text = $('jsonTextInput').value.trim();
  if(!text){ showStatus('statusError','Please paste JSON text.'); return; }
  showLoading('Parsing pasted JSON...');
  handleRawJSON(text, 'pasted-json.json', text.length, 'paste');
});

$('jsonTextInput').addEventListener('keydown', (e) => {
  if((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('loadTextBtn').click();
});

// ─── LOADING / ERROR STATES ──────────────────────────────────────────────────
function showLoading(msg='Parsing JSON...'){
  $('emptyState').style.display = 'none';
  $('loadingOverlay').classList.add('visible');
  $('loadingText').textContent = msg;
  $('treeHeader').style.display = 'none';
  $('treeViewport').style.display = 'none';
}

function showError(msg){
  $('loadingOverlay').classList.remove('visible');
  $('emptyState').style.display = 'flex';
  showStatus('statusError', msg);
}

// ─── MAIN ENTRY ──────────────────────────────────────────────────────────────
function handleRawJSON(text, name, size, loadMethod){
  // Defer parse so loading UI renders first
  setTimeout(() => {
    try {
      const data = JSON.parse(text);
      parsedData = data;
      currentFileName = name;
      currentFileSize = size;
      renderTree(data, name, size, text.length, loadMethod);
    } catch(err) {
      showError('Invalid JSON: ' + err.message);
    }
  }, 30);
}

// ─── RENDER TREE ─────────────────────────────────────────────────────────────
function renderTree(data, name, size, byteLen, loadMethod){
  nodeIdCounter = 0;
  rootDescriptor = null;
  const root = $('treeRoot');
  root.innerHTML = '';

  // Hide loading, show tree
  $('loadingOverlay').classList.remove('visible');
  $('treeHeader').style.display = 'flex';
  $('treeViewport').style.display = 'block';

  // Compute stats (fast, capped)
  const type = getType(data);
  const depth = countDepth(data);
  const topCount = type === 'array' ? data.length : (type === 'object' ? Object.keys(data).length : 0);

  // Update header
  $('treeHeaderTitle').textContent = name;
  $('treeHeaderMeta').textContent =
    formatBytes(byteLen) + ' · ' +
    (type === 'array' ? `[${topCount}]` : type === 'object' ? `{${topCount}}` : type) +
    ' · depth ~' + depth;

  // Show file info panel
  $('fileInfoSection').style.display = 'block';
  $('fileInfoGrid').innerHTML = `
    <span class="info-label">File</span><span class="info-value" title="${escHtml(name)}">${escHtml(name)}</span>
    <span class="info-label">Size</span><span class="info-value">${formatBytes(byteLen)}</span>
    <span class="info-label">Root type</span><span class="info-value">${type}</span>
    <span class="info-label">Top keys</span><span class="info-value">${topCount}</span>
    <span class="info-label">Est. depth</span><span class="info-value">${depth}</span>
  `;

  // Show controls
  $('controlsCard').style.display = 'block';
  $('downloadPngBtn').disabled = false;
  $('copyPngBtn').disabled = false;
  $('downloadSvgBtn').disabled = false;
  $('downloadNote').classList.add('visible');

  // Keep the successful load method expanded and collapse the unused inputs.
  setLoadMethodMode(loadMethod);

  // Render root node
  const desc = createDescriptor(data, null);
  rootDescriptor = desc;
  renderNode(desc, root);

  // Auto-expand root if it has children
  if(!isPrimitive(desc.type) && desc.childCount > 0){
    const rootNodeEl = root.querySelector('.tj-node');
    if(rootNodeEl) rootNodeEl.click();
  }

  // Reset pan/zoom to home position
  resetView();

  hideStatus();
  showStatus('statusSuccess', `Loaded ${name} (${formatBytes(byteLen)})`);
}

// ─── DESCRIPTOR FACTORY ──────────────────────────────────────────────────────
function createDescriptor(value, key){
  const type = getType(value);
  const desc = {
    id: nodeIdCounter++,
    key: key !== null && key !== undefined ? String(key) : null,
    type,
    rawRef: value,
    childCount: type === 'array' ? value.length : (type === 'object' ? Object.keys(value).length : 0),
    childKeys: type === 'object' ? Object.keys(value) : null,
    renderedCount: 0,
    expanded: false,
    containerEl: null,   // set when first expanded
    nodeEl: null,
    childDescriptors: [],
  };
  return desc;
}

// ─── RENDER NODE ─────────────────────────────────────────────────────────────
function renderNode(desc, parentEl){
  const item = document.createElement('div');
  item.className = 'tj-item';

  const node = document.createElement('div');
  node.className = `tj-node tj-${desc.type}`;
  desc.nodeEl = node;
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');

  const branchPreview = getBranchPreview(desc);
  if(branchPreview) node.classList.add('has-preview');

  // Key label
  if(desc.key !== null){
    const keySpan = document.createElement('span');
    keySpan.className = 'node-key';
    keySpan.textContent = desc.key;
    node.appendChild(keySpan);
    const colon = document.createElement('span');
    colon.className = branchPreview ? 'node-colon node-key-colon' : 'node-colon';
    colon.textContent = ':';
    node.appendChild(colon);
  }

  if(isPrimitive(desc.type)){
    // Primitive value
    const rawVal = desc.type === 'null' ? 'null' : JSON.stringify(desc.rawRef);
    const valSpan = document.createElement('span');
    valSpan.className = 'node-value';
    if(desc.type === 'string' && desc.rawRef.length > 120){
      valSpan.textContent = JSON.stringify(desc.rawRef.slice(0,120)) + '…';
      valSpan.className += ' expandable-str';
      valSpan.title = 'Click to expand';
      let expanded = false;
      valSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        expanded = !expanded;
        valSpan.textContent = expanded ? JSON.stringify(desc.rawRef) : JSON.stringify(desc.rawRef.slice(0,120)) + '…';
      });
    } else {
      valSpan.textContent = rawVal;
    }
    node.appendChild(valSpan);
  } else {
    // Object or array: show a useful first-entry preview for unnamed array branches,
    // then badge + optional toggle.
    appendBranchPreview(node, branchPreview);
    syncBranchPreviewState(node);
    const badge = document.createElement('span');
    badge.className = 'node-badge';
    badge.textContent = desc.type === 'array' ? `[${desc.childCount}]` : `{${desc.childCount}}`;
    node.appendChild(badge);

    if(desc.childCount > 0){
      const toggle = document.createElement('span');
      toggle.className = 'node-toggle';
      toggle.textContent = '▶';
      node.appendChild(toggle);
      node.classList.add('expandable');

      // Children container (lazy)
      const childrenEl = document.createElement('div');
      childrenEl.className = 'tj-children';
      childrenEl.style.display = 'none';
      desc.containerEl = childrenEl;
      item.appendChild(node);
      item.appendChild(childrenEl);

      node.addEventListener('click', () => toggleNode(desc, node, childrenEl));
      node.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleNode(desc, node, childrenEl); }
      });
      parentEl.appendChild(item);
      return;
    }
  }

  item.appendChild(node);
  parentEl.appendChild(item);
}

// ─── TOGGLE NODE ─────────────────────────────────────────────────────────────
function toggleNode(desc, nodeEl, childrenEl){
  if(desc.expanded){
    desc.expanded = false;
    childrenEl.style.display = 'none';
    nodeEl.classList.remove('is-expanded');
    syncBranchPreviewState(nodeEl);
  } else {
    desc.expanded = true;
    childrenEl.style.display = 'flex';
    nodeEl.classList.add('is-expanded');
    syncBranchPreviewState(nodeEl);
    if(desc.renderedCount === 0){
      if(desc.type === 'object') renderObjectChildren(desc, childrenEl);
      else renderArrayChunk(desc, childrenEl, 5);
    }
  }
}

// ─── RENDER OBJECT CHILDREN ──────────────────────────────────────────────────
function renderObjectChildren(desc, containerEl){
  const keys = desc.childKeys;
  const FIRST = Math.min(5, keys.length);
  for(let i = 0; i < FIRST; i++){
    const child = createDescriptor(desc.rawRef[keys[i]], keys[i]);
    desc.childDescriptors.push(child);
    renderNode(child, containerEl);
  }
  desc.renderedCount = FIRST;
  if(keys.length > FIRST) updateObjectPagination(desc, containerEl);
}

function updateObjectPagination(desc, containerEl){
  const existing = containerEl.querySelector('.pagination-row');
  if(existing) existing.remove();
  const remaining = desc.childKeys.length - desc.renderedCount;
  if(remaining <= 0) return;

  const row = document.createElement('div');
  row.className = 'pagination-row';

  getPageButtonConfigs(remaining).forEach(({ label, count }) => {
    const btn = makePageBtn(label, () => {
      const actual = count === -1 ? remaining : count;
      if(count === -1 && remaining > 500){
        if(!confirm(`Render all ${remaining} remaining items? This may be slow.`)) return;
      }
      const keys = desc.childKeys;
      const start = desc.renderedCount;
      const end = Math.min(start + actual, keys.length);
      for(let i = start; i < end; i++){
        const child = createDescriptor(desc.rawRef[keys[i]], keys[i]);
        desc.childDescriptors.push(child);
        renderNode(child, containerEl);
      }
      desc.renderedCount = end;
      updateObjectPagination(desc, containerEl);
    });
    row.appendChild(btn);
  });

  const countLabel = document.createElement('span');
  countLabel.className = 'pagination-count';
  countLabel.textContent = `${desc.renderedCount}/${desc.childKeys.length} keys`;
  row.appendChild(countLabel);
  containerEl.appendChild(row);
}

// ─── RENDER ARRAY CHUNK ──────────────────────────────────────────────────────
function renderArrayChunk(desc, containerEl, count){
  const start = desc.renderedCount;
  const end = Math.min(start + count, desc.childCount);
  for(let i = start; i < end; i++){
    const child = createDescriptor(desc.rawRef[i], i);
    desc.childDescriptors.push(child);
    renderNode(child, containerEl);
  }
  desc.renderedCount = end;
  updateArrayPagination(desc, containerEl);
}

function updateArrayPagination(desc, containerEl){
  const existing = containerEl.querySelector('.pagination-row');
  if(existing) existing.remove();
  const remaining = desc.childCount - desc.renderedCount;
  if(remaining <= 0) return;

  const row = document.createElement('div');
  row.className = 'pagination-row';

  getPageButtonConfigs(remaining).forEach(({ label, count }) => {
    const btn = makePageBtn(label, () => {
      const actual = count === -1 ? remaining : count;
      if(count === -1 && remaining > 500){
        if(!confirm(`Render all ${remaining} remaining items? This may be slow.`)) return;
      }
      renderArrayChunk(desc, containerEl, actual);
    });
    row.appendChild(btn);
  });

  const countLabel = document.createElement('span');
  countLabel.className = 'pagination-count';
  countLabel.textContent = `${desc.renderedCount}/${desc.childCount} items`;
  row.appendChild(countLabel);
  containerEl.appendChild(row);
}

// ─── ADAPTIVE PAGE BUTTON CONFIGS ────────────────────────────────────────────
function getPageButtonConfigs(remaining){
  if(remaining > 100) return [
    { label: 'Next 10', count: 10 },
    { label: 'Next 50', count: 50 },
    { label: `All (${remaining})`, count: -1 },
  ];
  if(remaining > 20) return [
    { label: 'Next 10', count: 10 },
    { label: 'Next 20', count: 20 },
    { label: `All (${remaining})`, count: -1 },
  ];
  if(remaining > 10) return [
    { label: 'Next 5', count: 5 },
    { label: 'Next 10', count: 10 },
    { label: `All (${remaining})`, count: -1 },
  ];
  if(remaining > 5) return [
    { label: 'Next 5', count: 5 },
    { label: `All (${remaining})`, count: -1 },
  ];
  return [{ label: `All (${remaining})`, count: -1 }];
}

function makePageBtn(label, handler){
  const btn = document.createElement('button');
  btn.className = 'btn-page';
  btn.textContent = label;
  btn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
  return btn;
}

// ─── EXPAND / COLLAPSE ALL ──────────────────────────────────────────────────
const EXPAND_ALL_WARN_NODE_LIMIT = 2500;
const EXPAND_ALL_WARN_BYTE_LIMIT = 1024 * 1024;

function estimateNodeCountForExpandAll(value, limit = EXPAND_ALL_WARN_NODE_LIMIT + 1){
  const stack = [value];
  let count = 0;
  while(stack.length){
    const current = stack.pop();
    count++;
    if(count >= limit) return count;
    if(current && typeof current === 'object'){
      if(Array.isArray(current)){
        for(let i = current.length - 1; i >= 0; i--) stack.push(current[i]);
      } else {
        const values = Object.values(current);
        for(let i = values.length - 1; i >= 0; i--) stack.push(values[i]);
      }
    }
  }
  return count;
}

function renderAllMissingChildren(desc){
  if(isPrimitive(desc.type) || desc.childCount === 0 || !desc.containerEl) return;
  const pagination = desc.containerEl.querySelector(':scope > .pagination-row');
  if(pagination) pagination.remove();

  if(desc.type === 'object'){
    const keys = desc.childKeys;
    for(let i = desc.renderedCount; i < keys.length; i++){
      const child = createDescriptor(desc.rawRef[keys[i]], keys[i]);
      desc.childDescriptors.push(child);
      renderNode(child, desc.containerEl);
    }
    desc.renderedCount = keys.length;
  } else if(desc.type === 'array'){
    for(let i = desc.renderedCount; i < desc.childCount; i++){
      const child = createDescriptor(desc.rawRef[i], i);
      desc.childDescriptors.push(child);
      renderNode(child, desc.containerEl);
    }
    desc.renderedCount = desc.childCount;
  }
}

function expandDescriptorAndChildren(desc){
  if(isPrimitive(desc.type) || desc.childCount === 0) return;
  desc.expanded = true;
  if(desc.containerEl) desc.containerEl.style.display = 'flex';
  if(desc.nodeEl) desc.nodeEl.classList.add('is-expanded');
  renderAllMissingChildren(desc);
  desc.childDescriptors.forEach(expandDescriptorAndChildren);
}

$('expandAllBtn').addEventListener('click', () => {
  if(!parsedData || !rootDescriptor) return;
  const estimatedNodes = estimateNodeCountForExpandAll(parsedData);
  const isTooBig = estimatedNodes > EXPAND_ALL_WARN_NODE_LIMIT || currentFileSize > EXPAND_ALL_WARN_BYTE_LIMIT;
  if(isTooBig){
    const nodeText = estimatedNodes > EXPAND_ALL_WARN_NODE_LIMIT ? `${EXPAND_ALL_WARN_NODE_LIMIT}+` : estimatedNodes;
    const sizeText = currentFileSize ? ` (${formatBytes(currentFileSize)})` : '';
    if(!confirm(`This JSON is large${sizeText}. Expanding all may render ${nodeText} nodes and can slow or freeze the browser. Continue?`)) return;
  }
  const btn = $('expandAllBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Expanding...';
  setTimeout(() => {
    try {
      expandDescriptorAndChildren(rootDescriptor);
      resetView();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Expand All';
    }
  }, 20);
});

$('collapseAllBtn').addEventListener('click', () => {
  $('treeRoot').querySelectorAll('.tj-node.is-expanded').forEach(nodeEl => {
    nodeEl.click();
  });
});

$('clearBtn').addEventListener('click', () => {
  parsedData = null;
  rootDescriptor = null;
  $('treeRoot').innerHTML = '';
  $('treeHeader').style.display = 'none';
  $('treeViewport').style.display = 'none';
  $('emptyState').style.display = 'flex';
  $('fileInfoSection').style.display = 'none';
  $('controlsCard').style.display = 'none';
  $('downloadNote').classList.remove('visible');
  setLoadMethodMode(null);
  hideStatus();
});

// ─── ESCAPE HTML ─────────────────────────────────────────────────────────────
function escHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── PAN / ZOOM ENGINE ───────────────────────────────────────────────────────
const VP_MIN = 0.1, VP_MAX = 4;
const vp = { x: 24, y: 24, scale: 1, dragging: false, lastX: 0, lastY: 0,
              pinchDist: 0, pinchMidX: 0, pinchMidY: 0 };

const vpEl     = $('treeViewport');
const canvasEl = $('treeCanvas');
const zoomLevelEl = $('zoomLevel');

function applyVP(){
  canvasEl.style.transform = `translate(${vp.x}px,${vp.y}px) scale(${vp.scale})`;
  zoomLevelEl.textContent = Math.round(vp.scale * 100) + '%';
}

function resetView(){
  vp.x = 24; vp.y = 24; vp.scale = 1;
  applyVP();
  showNavHint();
}

function zoomAt(cx, cy, factor){
  const newScale = Math.max(VP_MIN, Math.min(VP_MAX, vp.scale * factor));
  const f = newScale / vp.scale;
  vp.x = cx - (cx - vp.x) * f;
  vp.y = cy - (cy - vp.y) * f;
  vp.scale = newScale;
  applyVP();
}

// Nav hint (fades out after 3s of inactivity)
let hintTimer;
function showNavHint(){
  const h = $('navHint');
  h.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add('fade'), 3000);
}

// Mouse drag
vpEl.addEventListener('mousedown', (e) => {
  if(e.button !== 0) return;
  vp.dragging = true; vp.lastX = e.clientX; vp.lastY = e.clientY;
  vpEl.classList.add('panning');
  // Don't preventDefault on interactive elements — doing so suppresses their click events
  if(!e.target.closest('.tj-node, .btn-page, .expandable-str')) {
    e.preventDefault();
  }
});
window.addEventListener('mousemove', (e) => {
  if(!vp.dragging) return;
  vp.x += e.clientX - vp.lastX;
  vp.y += e.clientY - vp.lastY;
  vp.lastX = e.clientX; vp.lastY = e.clientY;
  applyVP();
});
window.addEventListener('mouseup', () => {
  vp.dragging = false;
  vpEl.classList.remove('panning');
});

// Scroll-wheel zoom (toward cursor)
vpEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = vpEl.getBoundingClientRect();
  const cx = e.clientX - r.left;
  const cy = e.clientY - r.top;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAt(cx, cy, factor);
}, { passive: false });

// Touch pan + pinch-to-zoom
vpEl.addEventListener('touchstart', (e) => {
  if(e.touches.length === 1){
    vp.lastX = e.touches[0].clientX;
    vp.lastY = e.touches[0].clientY;
  } else if(e.touches.length === 2){
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    vp.pinchDist  = Math.hypot(dx, dy);
    vp.pinchMidX  = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    vp.pinchMidY  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
  // Don't preventDefault for single-finger taps on interactive elements —
  // it would suppress the synthesised click event on mobile.
  if(e.touches.length !== 1 || !e.target.closest('.tj-node, .btn-page, .expandable-str')) {
    e.preventDefault();
  }
}, { passive: false });

vpEl.addEventListener('touchmove', (e) => {
  if(e.touches.length === 1){
    vp.x += e.touches[0].clientX - vp.lastX;
    vp.y += e.touches[0].clientY - vp.lastY;
    vp.lastX = e.touches[0].clientX;
    vp.lastY = e.touches[0].clientY;
    applyVP();
  } else if(e.touches.length === 2){
    const dx   = e.touches[0].clientX - e.touches[1].clientX;
    const dy   = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const r    = vpEl.getBoundingClientRect();
    zoomAt(midX - r.left, midY - r.top, dist / vp.pinchDist);
    vp.pinchDist = dist;
    // Also pan with pinch midpoint movement
    vp.x += midX - vp.pinchMidX;
    vp.y += midY - vp.pinchMidY;
    vp.pinchMidX = midX; vp.pinchMidY = midY;
    applyVP();
  }
  e.preventDefault();
}, { passive: false });

// Zoom buttons
$('zoomInBtn').addEventListener('click',  () => { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1.25); });
$('zoomOutBtn').addEventListener('click', () => { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1/1.25); });
$('zoomFitBtn').addEventListener('click', resetView);
$('zoomLevel').addEventListener('click',  resetView);

// Keyboard shortcuts (when viewport focused)
window.addEventListener('keydown', (e) => {
  if(!parsedData) return;
  if(e.target.tagName === 'INPUT') return;
  if(e.key === '=' || e.key === '+') { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1.25); e.preventDefault(); }
  if(e.key === '-')                  { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1/1.25); e.preventDefault(); }
  if(e.key === '0')                  { resetView(); e.preventDefault(); }
});

// ─── EXPORT HELPERS ──────────────────────────────────────────────────────────
// Replaces visible pagination button rows with a static "… N more" placeholder.
// Returns a restore function that puts the original rows back (event listeners intact).
function preparePaginationForExport() {
  const restores = [];
  document.querySelectorAll('.tj-children .pagination-row').forEach(row => {
    // Skip if the parent children container is collapsed
    const parent = row.closest('.tj-children');
    if(parent && parent.style.display === 'none') return;
    const countEl = row.querySelector('.pagination-count');
    if(!countEl) return;
    const match = countEl.textContent.match(/(\d+)\/(\d+)/);
    if(!match) return;
    const remaining = parseInt(match[2]) - parseInt(match[1]);
    if(remaining <= 0) return;

    const placeholder = document.createElement('div');
    placeholder.className = 'export-more-placeholder';
    placeholder.textContent = `… ${remaining} more`;
    row.parentNode.insertBefore(placeholder, row);
    row.style.display = 'none';
    restores.push(() => { row.style.display = ''; placeholder.remove(); });
  });
  return restores;
}


function addWatermarkToPngCanvas(sourceCanvas){
  const scale = 2;
  const footerH = 36 * scale;
  const sidePad = 12 * scale;
  const wmLogoSize = 13 * scale;
  const fontPx = 11 * scale;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `500 ${fontPx}px 'DM Sans', sans-serif`;
  const wmTextW = measure.measureText(EXPORT_WATERMARK_TEXT).width;
  const minWidth = Math.ceil(sidePad * 2 + wmLogoSize + 8 * scale + wmTextW);

  const output = document.createElement('canvas');
  output.width = Math.max(sourceCanvas.width, minWidth);
  output.height = sourceCanvas.height + footerH;

  const ctx = output.getContext('2d');
  ctx.clearRect(0, 0, output.width, output.height);
  ctx.drawImage(sourceCanvas, 0, 0);

  const wmX = output.width - sidePad;
  const wmY = output.height - 10 * scale;
  ctx.save();
  ctx.font = `500 ${fontPx}px 'DM Sans', sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3 * scale;
  if(wmLogoImg.complete && wmLogoImg.naturalWidth){
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.drawImage(wmLogoImg, wmX - wmTextW - 4 * scale - wmLogoSize, wmY - wmLogoSize + 2 * scale, wmLogoSize, wmLogoSize);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText(EXPORT_WATERMARK_TEXT, wmX, wmY);
  ctx.fillStyle = 'rgba(26,26,26,0.55)';
  ctx.fillText(EXPORT_WATERMARK_TEXT, wmX, wmY);
  ctx.restore();
  return output;
}

// ─── DOWNLOAD PNG ────────────────────────────────────────────────────────────
async function renderTreePngCanvas() {
  syncBranchPreviewStates($('treeRoot'));
  const restores = preparePaginationForExport();

  // Reset transform temporarily so html2canvas captures the full untransformed content
  const savedTransform = canvasEl.style.transform;
  canvasEl.style.transform = 'translate(0,0) scale(1)';

  try {
    const result = await html2canvas(canvasEl, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    return addWatermarkToPngCanvas(result);
  } finally {
    canvasEl.style.transform = savedTransform;
    restores.forEach(fn => fn());
  }
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
$('downloadPngBtn').addEventListener('click', async () => {
  const btn = $('downloadPngBtn');
  if(!parsedData) return;
  btn.disabled = true; btn.textContent = '⏳ Rendering...';
  try {
    const result = await renderTreePngCanvas();
    const a = document.createElement('a');
    a.href = result.toDataURL('image/png');
    a.download = (currentFileName.replace(/\.[^.]+$/, '') || 'json-tree') + '-tree.png';
    document.body.appendChild(a); a.click(); a.remove();
  } catch(err) {
    alert('PNG export failed: ' + err.message);
  }
  btn.disabled = false; btn.textContent = '⬇ PNG';
});
$('copyPngBtn').addEventListener('click', async () => {
  const btn = $('copyPngBtn');
  if(!parsedData) return;
  btn.disabled = true; btn.textContent = '⏳';
  try { await copyCanvasPngToClipboard(await renderTreePngCanvas()); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
  btn.disabled = false; btn.textContent = '⧉ PNG';
});

// ─── DOWNLOAD SVG ────────────────────────────────────────────────────────────
$('downloadSvgBtn').addEventListener('click', () => {
  if(!parsedData) return;
  const btn = $('downloadSvgBtn');
  btn.disabled = true; btn.textContent = '⏳ Building...';

  syncBranchPreviewStates($('treeRoot'));
  const svgRestores = preparePaginationForExport();

  // Reset transform temporarily so getBoundingClientRect gives un-scaled positions
  const savedTransform = canvasEl.style.transform;
  canvasEl.style.transform = 'translate(0,0) scale(1)';

  setTimeout(() => {
    try {
      const isDark = document.body.classList.contains('dark');
      const fg          = isDark ? '#EAF1FF'  : '#2D3436';
      const panelBg     = isDark ? '#1C2942'  : '#FFFFFF';
      const borderColor = isDark ? '#2C3A52'  : '#E0E6F0';
      const connectorColor = isDark ? '#2C3A52' : '#C8D4E8';

      const NS = 'http://www.w3.org/2000/svg';
      const canvasRect = canvasEl.getBoundingClientRect();
      const svgW = canvasEl.scrollWidth  + 48;
      const svgH = canvasEl.scrollHeight + 48;

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('xmlns', NS); svg.setAttribute('width', svgW); svg.setAttribute('height', svgH);
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

      const treeRootEl = $('treeRoot');
      const offsetX = canvasRect.left;
      const offsetY = canvasRect.top;

      // Connector lines (drawn below nodes). Vertical bar spans from first to last
      // child node centre; each child gets a horizontal line from the bar to its node.
      treeRootEl.querySelectorAll('.tj-children').forEach(childrenEl => {
        if(childrenEl.style.display === 'none') return;
        const cr = childrenEl.getBoundingClientRect();
        const lineX = cr.left - offsetX;
        const childNodes = [...childrenEl.children]
          .filter(child => child.classList.contains('tj-item'))
          .map(child => [...child.children].find(grandchild => grandchild.classList.contains('tj-node')))
          .filter(Boolean);
        if(childNodes.length < 1) return;
        const fr = childNodes[0].getBoundingClientRect();
        const lr = childNodes[childNodes.length - 1].getBoundingClientRect();
        const y1 = fr.top - offsetY + fr.height / 2;
        const y2 = lr.top - offsetY + lr.height / 2;
        if(y1 < y2){
          const vl = document.createElementNS(NS, 'line');
          vl.setAttribute('x1', lineX); vl.setAttribute('y1', y1);
          vl.setAttribute('x2', lineX); vl.setAttribute('y2', y2);
          vl.setAttribute('stroke', connectorColor); vl.setAttribute('stroke-width', '1');
          svg.appendChild(vl);
        }
        childNodes.forEach(nodeEl => {
          const nr = nodeEl.getBoundingClientRect();
          const nx = nr.left - offsetX;
          const ny = nr.top  - offsetY + nr.height / 2;
          const hl = document.createElementNS(NS, 'line');
          hl.setAttribute('x1', lineX); hl.setAttribute('y1', ny);
          hl.setAttribute('x2', nx);    hl.setAttribute('y2', ny);
          hl.setAttribute('stroke', connectorColor); hl.setAttribute('stroke-width', '1');
          svg.appendChild(hl);
        });
      });

      // Node boxes + text
      treeRootEl.querySelectorAll('.tj-node').forEach(nodeEl => {
        const nr = nodeEl.getBoundingClientRect();
        const x = nr.left - offsetX; const y = nr.top - offsetY;
        const cs = window.getComputedStyle(nodeEl);
        const box = document.createElementNS(NS, 'rect');
        box.setAttribute('x', x); box.setAttribute('y', y);
        box.setAttribute('width', nr.width); box.setAttribute('height', nr.height);
        box.setAttribute('rx', '8'); box.setAttribute('fill', panelBg);
        box.setAttribute('stroke', cs.borderColor || borderColor);
        svg.appendChild(box);

        const txt = getVisibleNodeText(nodeEl).slice(0, 90);

        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + 10); t.setAttribute('y', y + nr.height / 2);
        t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-family', 'DM Mono, monospace');
        t.setAttribute('font-size', '11');
        t.setAttribute('fill', fg);
        t.textContent = txt;
        svg.appendChild(t);
      });

      // "… N more" placeholders for truncated pagination
      treeRootEl.querySelectorAll('.export-more-placeholder').forEach(ph => {
        const pr = ph.getBoundingClientRect();
        if(pr.width === 0) return;
        const pt = document.createElementNS(NS, 'text');
        pt.setAttribute('x', pr.left - offsetX + 8);
        pt.setAttribute('y', pr.top - offsetY + pr.height / 2);
        pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-family', 'DM Mono, monospace');
        pt.setAttribute('font-size', '11');
        pt.setAttribute('fill', fg);
        pt.setAttribute('opacity', '0.6');
        pt.textContent = ph.textContent;
        svg.appendChild(pt);
      });

      // Watermark
      // Watermark text is baked to glyph outlines (WM_PATH) so the exported
      // SVG carries no editable/searchable string; renders identically.
      const wm = document.createElementNS(NS, 'path');
      wm.setAttribute('d', WM_PATH);
      wm.setAttribute('transform', 'translate(' + (svgW - 12 - WM_PATH_W) + ',' + (svgH - 12) + ')');
      wm.setAttribute('stroke', '#ffffff');
      wm.setAttribute('stroke-width', '3');
      wm.setAttribute('stroke-opacity', '0.70');
      wm.setAttribute('paint-order', 'stroke');
      wm.setAttribute('fill', '#1a1a1a');
      wm.setAttribute('fill-opacity', '0.45');
      svg.appendChild(wm);
      const wmLogoSize = 13;
      const wmTextW = WM_PATH_W;
      const wmLogo = document.createElementNS(NS, 'image');
      wmLogo.setAttribute('href', WM_LOGO_SRC);
      wmLogo.setAttributeNS('http://www.w3.org/1999/xlink', 'href', WM_LOGO_SRC);
      wmLogo.setAttribute('width', wmLogoSize);
      wmLogo.setAttribute('height', wmLogoSize);
      wmLogo.setAttribute('x', svgW - 12 - wmTextW - 4 - wmLogoSize);
      wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
      wmLogo.setAttribute('opacity', '0.45');
      svg.appendChild(wmLogo);

      canvasEl.style.transform = savedTransform;
      svgRestores.forEach(fn => fn());

      const xml  = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = (currentFileName.replace(/\.[^.]+$/, '') || 'json-tree') + '-tree.svg';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch(err) {
      canvasEl.style.transform = savedTransform;
      svgRestores.forEach(fn => fn());
      alert('SVG export failed: ' + err.message);
    }
    btn.disabled = false; btn.textContent = '⬇ SVG';
  }, 30);
});
