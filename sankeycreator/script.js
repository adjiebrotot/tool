(function(){
'use strict';

// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
// Watermark wordmark ("Made using tool.adjiebrotots.com/sankeycreator") baked to DM Sans 400 glyph
// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.
const WM_PATH = "M0.84 0V-7.7H1.92L4.58 -2.29L7.22 -7.7H8.31V0H7.39V-6.04L4.92 -1.04H4.23L1.76 -6.01V0ZM11.73 0.13Q11.07 0.13 10.62 -0.11Q10.18 -0.35 9.96 -0.76Q9.74 -1.16 9.74 -1.63Q9.74 -2.2 10.03 -2.59Q10.32 -2.99 10.85 -3.2Q11.38 -3.4 12.09 -3.4H13.54Q13.54 -3.95 13.4 -4.31Q13.26 -4.67 12.96 -4.86Q12.66 -5.04 12.18 -5.04Q11.68 -5.04 11.31 -4.78Q10.95 -4.53 10.86 -4.04H9.91Q9.98 -4.61 10.3 -5.01Q10.63 -5.41 11.13 -5.61Q11.63 -5.82 12.18 -5.82Q12.96 -5.82 13.47 -5.54Q13.97 -5.26 14.22 -4.76Q14.47 -4.26 14.47 -3.58V0H13.64L13.59 -0.99Q13.48 -0.76 13.31 -0.55Q13.14 -0.35 12.91 -0.2Q12.68 -0.04 12.39 0.04Q12.09 0.13 11.73 0.13ZM11.87 -0.65Q12.24 -0.65 12.55 -0.81Q12.86 -0.98 13.09 -1.25Q13.31 -1.53 13.43 -1.88Q13.54 -2.23 13.54 -2.61V-2.69H12.17Q11.65 -2.69 11.32 -2.56Q10.99 -2.43 10.85 -2.2Q10.71 -1.97 10.71 -1.67Q10.71 -1.36 10.84 -1.13Q10.98 -0.9 11.24 -0.78Q11.5 -0.65 11.87 -0.65ZM18.37 0.13Q17.58 0.13 16.99 -0.26Q16.39 -0.65 16.06 -1.32Q15.72 -2 15.72 -2.85Q15.72 -3.72 16.06 -4.38Q16.39 -5.05 16.99 -5.44Q17.59 -5.82 18.38 -5.82Q19.06 -5.82 19.56 -5.54Q20.06 -5.27 20.34 -4.77V-7.92H21.26V0H20.43L20.35 -0.92Q20.18 -0.65 19.91 -0.41Q19.64 -0.16 19.25 -0.02Q18.87 0.13 18.37 0.13ZM18.48 -0.67Q19.03 -0.67 19.44 -0.94Q19.86 -1.2 20.08 -1.69Q20.31 -2.18 20.31 -2.84Q20.31 -3.51 20.08 -3.99Q19.86 -4.48 19.44 -4.75Q19.03 -5.02 18.48 -5.02Q17.96 -5.02 17.55 -4.75Q17.13 -4.48 16.9 -3.99Q16.67 -3.51 16.67 -2.84Q16.67 -2.18 16.9 -1.69Q17.13 -1.2 17.55 -0.94Q17.96 -0.67 18.48 -0.67ZM25.22 0.13Q24.45 0.13 23.85 -0.24Q23.25 -0.61 22.92 -1.28Q22.58 -1.95 22.58 -2.84Q22.58 -3.74 22.91 -4.41Q23.25 -5.08 23.85 -5.45Q24.46 -5.82 25.24 -5.82Q26.07 -5.82 26.63 -5.45Q27.2 -5.08 27.49 -4.47Q27.78 -3.86 27.78 -3.13Q27.78 -3.02 27.78 -2.9Q27.78 -2.79 27.77 -2.63H23.27V-3.35H26.88Q26.85 -4.16 26.39 -4.6Q25.92 -5.04 25.22 -5.04Q24.76 -5.04 24.36 -4.82Q23.97 -4.6 23.72 -4.17Q23.48 -3.74 23.48 -3.1V-2.79Q23.48 -2.08 23.72 -1.6Q23.97 -1.12 24.36 -0.89Q24.76 -0.65 25.22 -0.65Q25.82 -0.65 26.19 -0.89Q26.55 -1.14 26.72 -1.58H27.63Q27.49 -1.09 27.17 -0.7Q26.84 -0.31 26.35 -0.09Q25.86 0.13 25.22 0.13ZM34.05 0.13Q33.41 0.13 32.93 -0.11Q32.46 -0.36 32.2 -0.87Q31.93 -1.38 31.93 -2.15V-5.69H32.86V-2.25Q32.86 -1.45 33.23 -1.06Q33.6 -0.66 34.25 -0.66Q34.7 -0.66 35.06 -0.87Q35.42 -1.08 35.64 -1.49Q35.85 -1.9 35.85 -2.49V-5.69H36.77V0H35.94L35.88 -0.94Q35.64 -0.43 35.16 -0.15Q34.67 0.13 34.05 0.13ZM40.42 0.13Q39.68 0.13 39.16 -0.1Q38.65 -0.33 38.37 -0.75Q38.09 -1.17 38.03 -1.74H38.98Q39.03 -1.44 39.19 -1.2Q39.36 -0.95 39.67 -0.8Q39.97 -0.65 40.43 -0.65Q40.81 -0.65 41.07 -0.76Q41.33 -0.88 41.46 -1.08Q41.59 -1.29 41.59 -1.55Q41.59 -1.9 41.43 -2.09Q41.27 -2.29 40.97 -2.39Q40.67 -2.49 40.22 -2.56Q39.78 -2.62 39.42 -2.74Q39.06 -2.86 38.79 -3.05Q38.53 -3.24 38.38 -3.52Q38.24 -3.81 38.24 -4.21Q38.24 -4.68 38.49 -5.04Q38.74 -5.41 39.2 -5.61Q39.66 -5.82 40.29 -5.82Q41.2 -5.82 41.75 -5.39Q42.3 -4.96 42.39 -4.16H41.48Q41.43 -4.57 41.12 -4.81Q40.8 -5.04 40.28 -5.04Q39.73 -5.04 39.45 -4.83Q39.17 -4.62 39.17 -4.28Q39.17 -4.04 39.31 -3.85Q39.44 -3.66 39.75 -3.53Q40.05 -3.4 40.53 -3.33Q41.14 -3.24 41.59 -3.07Q42.04 -2.91 42.29 -2.57Q42.55 -2.23 42.54 -1.62Q42.54 -1.07 42.28 -0.68Q42.01 -0.29 41.53 -0.08Q41.06 0.13 40.42 0.13ZM43.99 0V-5.69H44.91V0ZM44.45 -6.82Q44.17 -6.82 43.99 -7Q43.81 -7.18 43.81 -7.46Q43.81 -7.73 43.99 -7.9Q44.17 -8.07 44.45 -8.07Q44.71 -8.07 44.9 -7.9Q45.09 -7.73 45.09 -7.46Q45.09 -7.18 44.9 -7Q44.71 -6.82 44.45 -6.82ZM46.53 0V-5.69H47.37L47.42 -4.75Q47.67 -5.26 48.16 -5.54Q48.64 -5.82 49.27 -5.82Q49.91 -5.82 50.38 -5.57Q50.86 -5.33 51.12 -4.82Q51.38 -4.31 51.38 -3.54V0H50.46V-3.44Q50.46 -4.23 50.08 -4.63Q49.71 -5.03 49.06 -5.03Q48.62 -5.03 48.25 -4.82Q47.89 -4.6 47.67 -4.2Q47.46 -3.79 47.46 -3.2V0ZM55.11 2.55Q54.34 2.55 53.76 2.36Q53.17 2.17 52.85 1.77Q52.53 1.38 52.53 0.79Q52.53 0.53 52.63 0.23Q52.74 -0.06 52.99 -0.33Q53.25 -0.61 53.73 -0.83L54.4 -0.45Q53.8 -0.21 53.61 0.1Q53.43 0.42 53.43 0.7Q53.43 1.07 53.64 1.31Q53.85 1.55 54.23 1.67Q54.61 1.79 55.11 1.79Q55.59 1.79 55.94 1.66Q56.29 1.53 56.48 1.3Q56.68 1.06 56.68 0.73Q56.68 0.31 56.38 0.05Q56.09 -0.21 55.26 -0.26Q54.59 -0.3 54.15 -0.38Q53.7 -0.45 53.41 -0.56Q53.12 -0.66 52.93 -0.79Q52.74 -0.93 52.58 -1.07V-1.32L53.66 -2.37L54.51 -2.09L53.35 -1.1L53.49 -1.51Q53.62 -1.42 53.73 -1.34Q53.84 -1.27 54.03 -1.21Q54.22 -1.15 54.56 -1.1Q54.9 -1.05 55.47 -1Q56.24 -0.95 56.71 -0.74Q57.17 -0.53 57.38 -0.17Q57.59 0.19 57.59 0.7Q57.59 1.17 57.33 1.59Q57.07 2.01 56.52 2.28Q55.97 2.55 55.11 2.55ZM55.1 -1.78Q54.4 -1.78 53.91 -2.04Q53.42 -2.31 53.17 -2.77Q52.91 -3.23 52.91 -3.8Q52.91 -4.37 53.17 -4.82Q53.43 -5.28 53.91 -5.55Q54.4 -5.82 55.1 -5.82Q55.8 -5.82 56.29 -5.55Q56.77 -5.28 57.03 -4.82Q57.28 -4.37 57.28 -3.8Q57.28 -3.23 57.03 -2.77Q56.77 -2.31 56.29 -2.04Q55.8 -1.78 55.1 -1.78ZM55.1 -2.54Q55.7 -2.54 56.04 -2.85Q56.39 -3.17 56.39 -3.8Q56.39 -4.42 56.04 -4.73Q55.7 -5.05 55.1 -5.05Q54.51 -5.05 54.15 -4.73Q53.79 -4.42 53.79 -3.8Q53.79 -3.17 54.14 -2.85Q54.5 -2.54 55.1 -2.54ZM56.04 -4.91 55.76 -5.69H58.03V-4.99ZM64.28 0Q63.79 0 63.43 -0.15Q63.06 -0.31 62.87 -0.68Q62.68 -1.04 62.68 -1.67V-4.91H61.69V-5.69H62.68L62.8 -7.09H63.6V-5.69H65.23V-4.91H63.6V-1.67Q63.6 -1.16 63.81 -0.97Q64.02 -0.79 64.55 -0.79H65.19V0ZM68.95 0.13Q68.16 0.13 67.54 -0.24Q66.93 -0.6 66.58 -1.27Q66.24 -1.94 66.24 -2.84Q66.24 -3.75 66.59 -4.42Q66.94 -5.08 67.56 -5.45Q68.18 -5.82 68.97 -5.82Q69.78 -5.82 70.39 -5.45Q71 -5.08 71.35 -4.42Q71.69 -3.75 71.69 -2.84Q71.69 -1.94 71.34 -1.27Q70.99 -0.6 70.37 -0.24Q69.75 0.13 68.95 0.13ZM68.95 -0.66Q69.45 -0.66 69.86 -0.9Q70.26 -1.15 70.5 -1.63Q70.75 -2.12 70.75 -2.84Q70.75 -3.58 70.51 -4.06Q70.27 -4.54 69.87 -4.78Q69.47 -5.03 68.97 -5.03Q68.49 -5.03 68.08 -4.78Q67.67 -4.54 67.43 -4.06Q67.18 -3.57 67.18 -2.84Q67.18 -2.12 67.42 -1.63Q67.66 -1.15 68.07 -0.9Q68.47 -0.66 68.95 -0.66ZM75.51 0.13Q74.72 0.13 74.1 -0.24Q73.48 -0.6 73.14 -1.27Q72.79 -1.94 72.79 -2.84Q72.79 -3.75 73.14 -4.42Q73.49 -5.08 74.12 -5.45Q74.74 -5.82 75.53 -5.82Q76.33 -5.82 76.94 -5.45Q77.56 -5.08 77.9 -4.42Q78.25 -3.75 78.25 -2.84Q78.25 -1.94 77.9 -1.27Q77.54 -0.6 76.93 -0.24Q76.31 0.13 75.51 0.13ZM75.51 -0.66Q76 -0.66 76.41 -0.9Q76.82 -1.15 77.06 -1.63Q77.3 -2.12 77.3 -2.84Q77.3 -3.58 77.07 -4.06Q76.83 -4.54 76.43 -4.78Q76.02 -5.03 75.53 -5.03Q75.05 -5.03 74.64 -4.78Q74.23 -4.54 73.98 -4.06Q73.74 -3.57 73.74 -2.84Q73.74 -2.12 73.98 -1.63Q74.22 -1.15 74.62 -0.9Q75.02 -0.66 75.51 -0.66ZM79.58 0V-7.92H80.5V0ZM82.4 0.05Q82.14 0.05 81.95 -0.13Q81.77 -0.31 81.77 -0.57Q81.77 -0.84 81.95 -1.02Q82.14 -1.2 82.4 -1.2Q82.69 -1.2 82.86 -1.02Q83.03 -0.84 83.03 -0.57Q83.03 -0.31 82.86 -0.13Q82.69 0.05 82.4 0.05ZM86.1 0.13Q85.44 0.13 84.99 -0.11Q84.55 -0.35 84.33 -0.76Q84.11 -1.16 84.11 -1.63Q84.11 -2.2 84.4 -2.59Q84.69 -2.99 85.22 -3.2Q85.75 -3.4 86.46 -3.4H87.92Q87.92 -3.95 87.77 -4.31Q87.63 -4.67 87.33 -4.86Q87.03 -5.04 86.56 -5.04Q86.05 -5.04 85.68 -4.78Q85.32 -4.53 85.23 -4.04H84.28Q84.35 -4.61 84.67 -5.01Q85 -5.41 85.5 -5.61Q86 -5.82 86.56 -5.82Q87.33 -5.82 87.84 -5.54Q88.35 -5.26 88.59 -4.76Q88.84 -4.26 88.84 -3.58V0H88.01L87.96 -0.99Q87.85 -0.76 87.68 -0.55Q87.51 -0.35 87.28 -0.2Q87.05 -0.04 86.76 0.04Q86.46 0.13 86.1 0.13ZM86.24 -0.65Q86.61 -0.65 86.92 -0.81Q87.23 -0.98 87.46 -1.25Q87.68 -1.53 87.8 -1.88Q87.92 -2.23 87.92 -2.61V-2.69H86.54Q86.02 -2.69 85.69 -2.56Q85.37 -2.43 85.22 -2.2Q85.08 -1.97 85.08 -1.67Q85.08 -1.36 85.21 -1.13Q85.35 -0.9 85.61 -0.78Q85.87 -0.65 86.24 -0.65ZM92.74 0.13Q91.96 0.13 91.36 -0.26Q90.76 -0.65 90.43 -1.32Q90.09 -2 90.09 -2.85Q90.09 -3.72 90.43 -4.38Q90.76 -5.05 91.36 -5.44Q91.96 -5.82 92.75 -5.82Q93.43 -5.82 93.93 -5.54Q94.43 -5.27 94.71 -4.77V-7.92H95.63V0H94.8L94.72 -0.92Q94.55 -0.65 94.28 -0.41Q94.01 -0.16 93.63 -0.02Q93.24 0.13 92.74 0.13ZM92.85 -0.67Q93.4 -0.67 93.82 -0.94Q94.23 -1.2 94.45 -1.69Q94.68 -2.18 94.68 -2.84Q94.68 -3.51 94.45 -3.99Q94.23 -4.48 93.82 -4.75Q93.4 -5.02 92.85 -5.02Q92.33 -5.02 91.92 -4.75Q91.51 -4.48 91.27 -3.99Q91.04 -3.51 91.04 -2.84Q91.04 -2.18 91.27 -1.69Q91.51 -1.2 91.92 -0.94Q92.33 -0.67 92.85 -0.67ZM96.11 2.42V1.63H96.54Q96.96 1.63 97.13 1.46Q97.31 1.29 97.31 0.88V-5.69H98.23V0.9Q98.23 1.43 98.06 1.77Q97.88 2.1 97.54 2.26Q97.19 2.42 96.68 2.42ZM97.78 -6.82Q97.51 -6.82 97.33 -7Q97.15 -7.18 97.15 -7.46Q97.15 -7.73 97.33 -7.9Q97.51 -8.07 97.78 -8.07Q98.05 -8.07 98.23 -7.9Q98.41 -7.73 98.41 -7.46Q98.41 -7.18 98.23 -7Q98.05 -6.82 97.78 -6.82ZM99.94 0V-5.69H100.87V0ZM100.4 -6.82Q100.13 -6.82 99.95 -7Q99.77 -7.18 99.77 -7.46Q99.77 -7.73 99.95 -7.9Q100.13 -8.07 100.4 -8.07Q100.67 -8.07 100.86 -7.9Q101.04 -7.73 101.04 -7.46Q101.04 -7.18 100.86 -7Q100.67 -6.82 100.4 -6.82ZM104.91 0.13Q104.13 0.13 103.54 -0.24Q102.94 -0.61 102.6 -1.28Q102.26 -1.95 102.26 -2.84Q102.26 -3.74 102.6 -4.41Q102.93 -5.08 103.54 -5.45Q104.14 -5.82 104.93 -5.82Q105.75 -5.82 106.32 -5.45Q106.88 -5.08 107.18 -4.47Q107.47 -3.86 107.47 -3.13Q107.47 -3.02 107.47 -2.9Q107.47 -2.79 107.46 -2.63H102.95V-3.35H106.56Q106.54 -4.16 106.07 -4.6Q105.6 -5.04 104.91 -5.04Q104.44 -5.04 104.05 -4.82Q103.65 -4.6 103.41 -4.17Q103.16 -3.74 103.16 -3.1V-2.79Q103.16 -2.08 103.41 -1.6Q103.65 -1.12 104.05 -0.89Q104.44 -0.65 104.91 -0.65Q105.51 -0.65 105.87 -0.89Q106.23 -1.14 106.4 -1.58H107.31Q107.18 -1.09 106.85 -0.7Q106.53 -0.31 106.04 -0.09Q105.55 0.13 104.91 0.13ZM111.62 0.13Q111.12 0.13 110.74 -0.02Q110.36 -0.17 110.09 -0.41Q109.82 -0.64 109.64 -0.91L109.56 0H108.73V-7.92H109.65V-4.78Q109.92 -5.26 110.43 -5.54Q110.93 -5.82 111.61 -5.82Q112.41 -5.82 113 -5.44Q113.6 -5.06 113.93 -4.39Q114.26 -3.72 114.26 -2.86Q114.26 -2 113.93 -1.32Q113.6 -0.64 113.01 -0.26Q112.41 0.13 111.62 0.13ZM111.51 -0.67Q112.03 -0.67 112.44 -0.94Q112.85 -1.2 113.09 -1.69Q113.32 -2.18 113.32 -2.84Q113.32 -3.51 113.09 -3.99Q112.85 -4.48 112.44 -4.75Q112.03 -5.02 111.51 -5.02Q110.96 -5.02 110.54 -4.75Q110.13 -4.48 109.91 -3.99Q109.68 -3.51 109.68 -2.84Q109.68 -2.18 109.91 -1.69Q110.13 -1.2 110.54 -0.94Q110.96 -0.67 111.51 -0.67ZM115.59 0V-5.69H116.43L116.5 -4.63Q116.69 -5.02 117 -5.28Q117.31 -5.55 117.75 -5.68Q118.18 -5.82 118.74 -5.82V-4.85H118.26Q117.92 -4.85 117.61 -4.76Q117.29 -4.67 117.05 -4.47Q116.8 -4.27 116.66 -3.92Q116.52 -3.57 116.52 -3.05V0ZM122.28 0.13Q121.49 0.13 120.87 -0.24Q120.26 -0.6 119.91 -1.27Q119.56 -1.94 119.56 -2.84Q119.56 -3.75 119.91 -4.42Q120.27 -5.08 120.89 -5.45Q121.51 -5.82 122.3 -5.82Q123.1 -5.82 123.72 -5.45Q124.33 -5.08 124.67 -4.42Q125.02 -3.75 125.02 -2.84Q125.02 -1.94 124.67 -1.27Q124.32 -0.6 123.7 -0.24Q123.08 0.13 122.28 0.13ZM122.28 -0.66Q122.78 -0.66 123.18 -0.9Q123.59 -1.15 123.83 -1.63Q124.07 -2.12 124.07 -2.84Q124.07 -3.58 123.84 -4.06Q123.6 -4.54 123.2 -4.78Q122.8 -5.03 122.3 -5.03Q121.82 -5.03 121.41 -4.78Q121 -4.54 120.75 -4.06Q120.51 -3.57 120.51 -2.84Q120.51 -2.12 120.75 -1.63Q120.99 -1.15 121.39 -0.9Q121.8 -0.66 122.28 -0.66ZM128.57 0Q128.07 0 127.71 -0.15Q127.35 -0.31 127.15 -0.68Q126.96 -1.04 126.96 -1.67V-4.91H125.97V-5.69H126.96L127.08 -7.09H127.89V-5.69H129.52V-4.91H127.89V-1.67Q127.89 -1.16 128.1 -0.97Q128.3 -0.79 128.83 -0.79H129.47V0ZM133.23 0.13Q132.44 0.13 131.83 -0.24Q131.21 -0.6 130.87 -1.27Q130.52 -1.94 130.52 -2.84Q130.52 -3.75 130.87 -4.42Q131.22 -5.08 131.84 -5.45Q132.47 -5.82 133.26 -5.82Q134.06 -5.82 134.67 -5.45Q135.28 -5.08 135.63 -4.42Q135.98 -3.75 135.98 -2.84Q135.98 -1.94 135.62 -1.27Q135.27 -0.6 134.65 -0.24Q134.04 0.13 133.23 0.13ZM133.24 -0.66Q133.73 -0.66 134.14 -0.9Q134.55 -1.15 134.79 -1.63Q135.03 -2.12 135.03 -2.84Q135.03 -3.58 134.79 -4.06Q134.56 -4.54 134.15 -4.78Q133.75 -5.03 133.26 -5.03Q132.77 -5.03 132.36 -4.78Q131.96 -4.54 131.71 -4.06Q131.47 -3.57 131.47 -2.84Q131.47 -2.12 131.71 -1.63Q131.95 -1.15 132.35 -0.9Q132.75 -0.66 133.24 -0.66ZM139.52 0Q139.03 0 138.67 -0.15Q138.3 -0.31 138.11 -0.68Q137.92 -1.04 137.92 -1.67V-4.91H136.93V-5.69H137.92L138.04 -7.09H138.84V-5.69H140.47V-4.91H138.84V-1.67Q138.84 -1.16 139.05 -0.97Q139.26 -0.79 139.79 -0.79H140.43V0ZM143.8 0.13Q143.05 0.13 142.54 -0.1Q142.03 -0.33 141.75 -0.75Q141.47 -1.17 141.41 -1.74H142.36Q142.41 -1.44 142.57 -1.2Q142.74 -0.95 143.04 -0.8Q143.35 -0.65 143.81 -0.65Q144.19 -0.65 144.45 -0.76Q144.71 -0.88 144.84 -1.08Q144.97 -1.29 144.97 -1.55Q144.97 -1.9 144.81 -2.09Q144.65 -2.29 144.35 -2.39Q144.04 -2.49 143.6 -2.56Q143.16 -2.62 142.8 -2.74Q142.43 -2.86 142.17 -3.05Q141.9 -3.24 141.76 -3.52Q141.62 -3.81 141.62 -4.21Q141.62 -4.68 141.87 -5.04Q142.12 -5.41 142.58 -5.61Q143.04 -5.82 143.67 -5.82Q144.58 -5.82 145.13 -5.39Q145.68 -4.96 145.77 -4.16H144.86Q144.81 -4.57 144.49 -4.81Q144.18 -5.04 143.65 -5.04Q143.11 -5.04 142.83 -4.83Q142.55 -4.62 142.55 -4.28Q142.55 -4.04 142.69 -3.85Q142.82 -3.66 143.12 -3.53Q143.43 -3.4 143.91 -3.33Q144.52 -3.24 144.97 -3.07Q145.42 -2.91 145.67 -2.57Q145.92 -2.23 145.92 -1.62Q145.92 -1.07 145.65 -0.68Q145.39 -0.29 144.91 -0.08Q144.44 0.13 143.8 0.13ZM147.62 0.05Q147.35 0.05 147.17 -0.13Q146.99 -0.31 146.99 -0.57Q146.99 -0.84 147.17 -1.02Q147.35 -1.2 147.62 -1.2Q147.9 -1.2 148.08 -1.02Q148.25 -0.84 148.25 -0.57Q148.25 -0.31 148.08 -0.13Q147.9 0.05 147.62 0.05ZM152.02 0.13Q151.23 0.13 150.61 -0.24Q149.99 -0.61 149.64 -1.28Q149.29 -1.96 149.29 -2.84Q149.29 -3.74 149.64 -4.41Q149.99 -5.07 150.61 -5.45Q151.23 -5.82 152.02 -5.82Q153 -5.82 153.67 -5.3Q154.33 -4.78 154.51 -3.9H153.57Q153.45 -4.44 153.02 -4.73Q152.59 -5.03 152.01 -5.03Q151.51 -5.03 151.11 -4.78Q150.71 -4.53 150.47 -4.05Q150.23 -3.57 150.23 -2.84Q150.23 -2.31 150.37 -1.89Q150.51 -1.48 150.75 -1.2Q150.98 -0.93 151.31 -0.79Q151.63 -0.65 152.01 -0.65Q152.4 -0.65 152.72 -0.78Q153.04 -0.92 153.27 -1.17Q153.49 -1.43 153.57 -1.79H154.51Q154.34 -0.93 153.67 -0.4Q153 0.13 152.02 0.13ZM158.33 0.13Q157.53 0.13 156.92 -0.24Q156.3 -0.6 155.96 -1.27Q155.61 -1.94 155.61 -2.84Q155.61 -3.75 155.96 -4.42Q156.31 -5.08 156.93 -5.45Q157.56 -5.82 158.35 -5.82Q159.15 -5.82 159.76 -5.45Q160.37 -5.08 160.72 -4.42Q161.07 -3.75 161.07 -2.84Q161.07 -1.94 160.71 -1.27Q160.36 -0.6 159.75 -0.24Q159.13 0.13 158.33 0.13ZM158.33 -0.66Q158.82 -0.66 159.23 -0.9Q159.64 -1.15 159.88 -1.63Q160.12 -2.12 160.12 -2.84Q160.12 -3.58 159.88 -4.06Q159.65 -4.54 159.25 -4.78Q158.84 -5.03 158.35 -5.03Q157.86 -5.03 157.46 -4.78Q157.05 -4.54 156.8 -4.06Q156.56 -3.57 156.56 -2.84Q156.56 -2.12 156.8 -1.63Q157.04 -1.15 157.44 -0.9Q157.84 -0.66 158.33 -0.66ZM162.4 0V-5.69H163.23L163.28 -4.9Q163.55 -5.33 164 -5.57Q164.44 -5.82 164.95 -5.82Q165.38 -5.82 165.72 -5.7Q166.06 -5.59 166.32 -5.35Q166.57 -5.12 166.73 -4.76Q167.02 -5.27 167.51 -5.55Q168.01 -5.82 168.55 -5.82Q169.2 -5.82 169.66 -5.57Q170.12 -5.32 170.38 -4.81Q170.63 -4.3 170.63 -3.53V0H169.72V-3.43Q169.72 -4.23 169.38 -4.63Q169.03 -5.03 168.44 -5.03Q168.03 -5.03 167.69 -4.81Q167.36 -4.6 167.17 -4.18Q166.98 -3.77 166.98 -3.17V0H166.05V-3.43Q166.05 -4.23 165.71 -4.63Q165.37 -5.03 164.78 -5.03Q164.38 -5.03 164.05 -4.81Q163.72 -4.6 163.52 -4.18Q163.32 -3.77 163.32 -3.17V0ZM171.66 1.04 174.42 -8.4H175.34L172.58 1.04ZM178.52 0.13Q177.78 0.13 177.27 -0.1Q176.76 -0.33 176.48 -0.75Q176.2 -1.17 176.14 -1.74H177.08Q177.13 -1.44 177.3 -1.2Q177.47 -0.95 177.77 -0.8Q178.08 -0.65 178.53 -0.65Q178.92 -0.65 179.17 -0.76Q179.43 -0.88 179.57 -1.08Q179.7 -1.29 179.7 -1.55Q179.7 -1.9 179.54 -2.09Q179.38 -2.29 179.08 -2.39Q178.77 -2.49 178.33 -2.56Q177.89 -2.62 177.52 -2.74Q177.16 -2.86 176.9 -3.05Q176.63 -3.24 176.49 -3.52Q176.34 -3.81 176.34 -4.21Q176.34 -4.68 176.59 -5.04Q176.84 -5.41 177.3 -5.61Q177.76 -5.82 178.39 -5.82Q179.31 -5.82 179.86 -5.39Q180.4 -4.96 180.5 -4.16H179.59Q179.53 -4.57 179.22 -4.81Q178.91 -5.04 178.38 -5.04Q177.84 -5.04 177.56 -4.83Q177.28 -4.62 177.28 -4.28Q177.28 -4.04 177.41 -3.85Q177.55 -3.66 177.85 -3.53Q178.15 -3.4 178.63 -3.33Q179.24 -3.24 179.69 -3.07Q180.15 -2.91 180.4 -2.57Q180.65 -2.23 180.64 -1.62Q180.65 -1.07 180.38 -0.68Q180.12 -0.29 179.64 -0.08Q179.16 0.13 178.52 0.13ZM183.81 0.13Q183.14 0.13 182.7 -0.11Q182.25 -0.35 182.03 -0.76Q181.81 -1.16 181.81 -1.63Q181.81 -2.2 182.11 -2.59Q182.4 -2.99 182.93 -3.2Q183.46 -3.4 184.17 -3.4H185.62Q185.62 -3.95 185.48 -4.31Q185.33 -4.67 185.03 -4.86Q184.73 -5.04 184.26 -5.04Q183.75 -5.04 183.38 -4.78Q183.02 -4.53 182.93 -4.04H181.99Q182.05 -4.61 182.38 -5.01Q182.7 -5.41 183.2 -5.61Q183.7 -5.82 184.26 -5.82Q185.03 -5.82 185.54 -5.54Q186.05 -5.26 186.29 -4.76Q186.54 -4.26 186.54 -3.58V0H185.72L185.66 -0.99Q185.55 -0.76 185.38 -0.55Q185.21 -0.35 184.98 -0.2Q184.75 -0.04 184.46 0.04Q184.17 0.13 183.81 0.13ZM183.94 -0.65Q184.31 -0.65 184.62 -0.81Q184.93 -0.98 185.16 -1.25Q185.38 -1.53 185.5 -1.88Q185.62 -2.23 185.62 -2.61V-2.69H184.24Q183.72 -2.69 183.39 -2.56Q183.07 -2.43 182.92 -2.2Q182.78 -1.97 182.78 -1.67Q182.78 -1.36 182.92 -1.13Q183.05 -0.9 183.31 -0.78Q183.57 -0.65 183.94 -0.65ZM188.03 0V-5.69H188.86L188.91 -4.75Q189.17 -5.26 189.65 -5.54Q190.13 -5.82 190.76 -5.82Q191.4 -5.82 191.88 -5.57Q192.35 -5.33 192.61 -4.82Q192.88 -4.31 192.88 -3.54V0H191.95V-3.44Q191.95 -4.23 191.58 -4.63Q191.2 -5.03 190.55 -5.03Q190.11 -5.03 189.75 -4.82Q189.38 -4.6 189.17 -4.2Q188.95 -3.79 188.95 -3.2V0ZM197.77 0 195.13 -3.09 197.58 -5.69H198.72L195.91 -2.76L195.93 -3.42L198.95 0ZM194.36 0V-7.92H195.29V0ZM202.33 0.13Q201.56 0.13 200.96 -0.24Q200.37 -0.61 200.03 -1.28Q199.69 -1.95 199.69 -2.84Q199.69 -3.74 200.02 -4.41Q200.36 -5.08 200.96 -5.45Q201.57 -5.82 202.35 -5.82Q203.18 -5.82 203.75 -5.45Q204.31 -5.08 204.6 -4.47Q204.89 -3.86 204.89 -3.13Q204.89 -3.02 204.89 -2.9Q204.89 -2.79 204.88 -2.63H200.38V-3.35H203.99Q203.96 -4.16 203.5 -4.6Q203.03 -5.04 202.33 -5.04Q201.87 -5.04 201.47 -4.82Q201.08 -4.6 200.83 -4.17Q200.59 -3.74 200.59 -3.1V-2.79Q200.59 -2.08 200.83 -1.6Q201.08 -1.12 201.48 -0.89Q201.87 -0.65 202.33 -0.65Q202.94 -0.65 203.3 -0.89Q203.66 -1.14 203.83 -1.58H204.74Q204.61 -1.09 204.28 -0.7Q203.95 -0.31 203.46 -0.09Q202.97 0.13 202.33 0.13ZM206.79 2.42 208.11 -0.62H207.79L205.62 -5.69H206.63L208.42 -1.32L210.3 -5.69H211.26L207.75 2.42ZM214.78 0.13Q213.99 0.13 213.38 -0.24Q212.76 -0.61 212.4 -1.28Q212.05 -1.96 212.05 -2.84Q212.05 -3.74 212.4 -4.41Q212.76 -5.07 213.38 -5.45Q213.99 -5.82 214.78 -5.82Q215.77 -5.82 216.43 -5.3Q217.1 -4.78 217.28 -3.9H216.33Q216.22 -4.44 215.78 -4.73Q215.35 -5.03 214.77 -5.03Q214.28 -5.03 213.88 -4.78Q213.47 -4.53 213.24 -4.05Q213 -3.57 213 -2.84Q213 -2.31 213.13 -1.89Q213.27 -1.48 213.51 -1.2Q213.75 -0.93 214.08 -0.79Q214.4 -0.65 214.77 -0.65Q215.17 -0.65 215.49 -0.78Q215.81 -0.92 216.03 -1.17Q216.26 -1.43 216.33 -1.79H217.28Q217.1 -0.93 216.43 -0.4Q215.76 0.13 214.78 0.13ZM218.61 0V-5.69H219.44L219.51 -4.63Q219.7 -5.02 220.01 -5.28Q220.32 -5.55 220.76 -5.68Q221.2 -5.82 221.75 -5.82V-4.85H221.27Q220.94 -4.85 220.62 -4.76Q220.31 -4.67 220.06 -4.47Q219.81 -4.27 219.67 -3.92Q219.53 -3.57 219.53 -3.05V0ZM225.22 0.13Q224.45 0.13 223.85 -0.24Q223.26 -0.61 222.92 -1.28Q222.58 -1.95 222.58 -2.84Q222.58 -3.74 222.92 -4.41Q223.25 -5.08 223.86 -5.45Q224.46 -5.82 225.25 -5.82Q226.07 -5.82 226.64 -5.45Q227.2 -5.08 227.49 -4.47Q227.79 -3.86 227.79 -3.13Q227.79 -3.02 227.79 -2.9Q227.79 -2.79 227.77 -2.63H223.27V-3.35H226.88Q226.86 -4.16 226.39 -4.6Q225.92 -5.04 225.22 -5.04Q224.76 -5.04 224.36 -4.82Q223.97 -4.6 223.72 -4.17Q223.48 -3.74 223.48 -3.1V-2.79Q223.48 -2.08 223.73 -1.6Q223.97 -1.12 224.37 -0.89Q224.76 -0.65 225.22 -0.65Q225.83 -0.65 226.19 -0.89Q226.55 -1.14 226.72 -1.58H227.63Q227.5 -1.09 227.17 -0.7Q226.84 -0.31 226.35 -0.09Q225.87 0.13 225.22 0.13ZM230.85 0.13Q230.19 0.13 229.74 -0.11Q229.3 -0.35 229.08 -0.76Q228.86 -1.16 228.86 -1.63Q228.86 -2.2 229.15 -2.59Q229.44 -2.99 229.97 -3.2Q230.5 -3.4 231.21 -3.4H232.66Q232.66 -3.95 232.52 -4.31Q232.38 -4.67 232.08 -4.86Q231.78 -5.04 231.3 -5.04Q230.8 -5.04 230.43 -4.78Q230.07 -4.53 229.98 -4.04H229.03Q229.1 -4.61 229.42 -5.01Q229.75 -5.41 230.25 -5.61Q230.75 -5.82 231.3 -5.82Q232.08 -5.82 232.59 -5.54Q233.09 -5.26 233.34 -4.76Q233.59 -4.26 233.59 -3.58V0H232.76L232.71 -0.99Q232.6 -0.76 232.43 -0.55Q232.26 -0.35 232.03 -0.2Q231.8 -0.04 231.51 0.04Q231.21 0.13 230.85 0.13ZM230.99 -0.65Q231.36 -0.65 231.67 -0.81Q231.98 -0.98 232.21 -1.25Q232.43 -1.53 232.55 -1.88Q232.66 -2.23 232.66 -2.61V-2.69H231.29Q230.77 -2.69 230.44 -2.56Q230.11 -2.43 229.97 -2.2Q229.83 -1.97 229.83 -1.67Q229.83 -1.36 229.96 -1.13Q230.1 -0.9 230.36 -0.78Q230.62 -0.65 230.99 -0.65ZM237.29 0Q236.8 0 236.43 -0.15Q236.07 -0.31 235.88 -0.68Q235.69 -1.04 235.69 -1.67V-4.91H234.69V-5.69H235.69L235.81 -7.09H236.61V-5.69H238.24V-4.91H236.61V-1.67Q236.61 -1.16 236.82 -0.97Q237.03 -0.79 237.56 -0.79H238.2V0ZM241.96 0.13Q241.17 0.13 240.55 -0.24Q239.94 -0.6 239.59 -1.27Q239.24 -1.94 239.24 -2.84Q239.24 -3.75 239.59 -4.42Q239.95 -5.08 240.57 -5.45Q241.19 -5.82 241.98 -5.82Q242.78 -5.82 243.4 -5.45Q244.01 -5.08 244.35 -4.42Q244.7 -3.75 244.7 -2.84Q244.7 -1.94 244.35 -1.27Q244 -0.6 243.38 -0.24Q242.76 0.13 241.96 0.13ZM241.96 -0.66Q242.46 -0.66 242.86 -0.9Q243.27 -1.15 243.51 -1.63Q243.75 -2.12 243.75 -2.84Q243.75 -3.58 243.52 -4.06Q243.28 -4.54 242.88 -4.78Q242.48 -5.03 241.98 -5.03Q241.5 -5.03 241.09 -4.78Q240.68 -4.54 240.43 -4.06Q240.19 -3.57 240.19 -2.84Q240.19 -2.12 240.43 -1.63Q240.67 -1.15 241.07 -0.9Q241.48 -0.66 241.96 -0.66ZM246.03 0V-5.69H246.87L246.94 -4.63Q247.13 -5.02 247.44 -5.28Q247.75 -5.55 248.18 -5.68Q248.62 -5.82 249.17 -5.82V-4.85H248.7Q248.36 -4.85 248.05 -4.76Q247.73 -4.67 247.48 -4.47Q247.24 -4.27 247.1 -3.92Q246.95 -3.57 246.95 -3.05V0Z";
const WM_PATH_W = 249.46;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

// ═══════════════════════════════════════════════
//  PALETTES
// ═══════════════════════════════════════════════
const PALETTES = {
  tableau:['#4E79A7','#F28E2B','#E15759','#76B7B2','#59A14F','#EDC948','#B07AA1','#FF9DA7','#9C755F','#BAB0AC'],
  d3cat:  ['#1F77B4','#FF7F0E','#2CA02C','#D62728','#9467BD','#8C564B','#E377C2','#7F7F7F','#BCBD22','#17BECF'],
  pastel: ['#8DBBFF','#FF8B8B','#8FCDBD','#F1C0D0','#FFD28C','#B5A8FF','#A8E6CF','#F9C74F','#C9F0D1','#FFB3BA'],
  vivid:  ['#E63946','#2A9D8F','#E9C46A','#F4A261','#264653','#A8DADC','#457B9D','#6A0572','#F77F00','#7B2D8B'],
  cool:   ['#08519C','#3182BD','#6BAED6','#9ECAE1','#C6DBEF','#238B45','#41AB5D','#74C476','#A1D99B','#C7E9C0'],
  warm:   ['#D73027','#F46D43','#FDAE61','#FEE08B','#7FBC41','#4393C3','#F4A582','#D6604D','#FFEDA0','#FEB24C'],
};

// ═══════════════════════════════════════════════
//  DEFAULTS
// ═══════════════════════════════════════════════
const DEFAULT_ROWS = [
  {source:'Husband Income',  target:'Family Income', value:'5000', color:'#6BA5D7'},
  {source:'Wife Income',     target:'Family Income', value:'4000', color:'#82C4A0'},
  {source:'Family Income',   target:'Housing',       value:'2200', color:''},
  {source:'Family Income',   target:'Food',          value:'900',  color:''},
  {source:'Family Income',   target:'Transport',     value:'600',  color:''},
  {source:'Family Income',   target:'Savings',       value:'1500', color:'#8FCDBD'},
  {source:'Family Income',   target:'Leisure',       value:'remaining', color:''},
  {source:'Housing',         target:'Mortgage',      value:'1600', color:''},
  {source:'Housing',         target:'Utilities',     value:'remaining', color:''},
  {source:'Savings',         target:'Emergency Fund',value:'500',  color:'#8FCDBD'},
  {source:'Savings',         target:'Investments',   value:'remaining', color:'#6BA5D7'},
];
const DEFAULT_S = {align:'justify',pad:20,nw:18,op:42,h:520,scheme:'tableau',label:'auto',linkStyle:'gradient',iter:32,labelBox:false,valueMode:'nominal'};

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let rows = clone(DEFAULT_ROWS);
let S    = clone(DEFAULT_S);

function clone(x){ return JSON.parse(JSON.stringify(x)); }

// ═══════════════════════════════════════════════
//  DOM
// ═══════════════════════════════════════════════
const $  = id => document.getElementById(id);
const svgEl      = $('sankeySvg');
const tip        = $('tooltip');
const tableBody  = $('tableBody');
const txtIn      = $('textInput');
const errBanner  = $('errBanner');
const emptyState = $('emptyState');

// ═══════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════
function nodeColor(name){
  const pal = PALETTES[S.scheme] || PALETTES.tableau;
  let h = 5381;
  for(let i=0;i<name.length;i++) h=((h<<5)+h)+name.charCodeAt(i)|0;
  return pal[Math.abs(h) % pal.length];
}

function fmtNum(v){
  if(v==null||isNaN(v)) return '—';
  if(v>=1e9) return (v/1e9).toFixed(2).replace(/\.?0+$/,'')+'B';
  if(v>=1e6) return (v/1e6).toFixed(2).replace(/\.?0+$/,'')+'M';
  if(v>=1e3) return (v/1e3).toFixed(1).replace(/\.?0+$/,'')+'K';
  return Number(v).toLocaleString('en-AU',{maximumFractionDigits:2});
}

function hex(c){ return /^#[0-9A-Fa-f]{3,8}$/.test(c); }

function cssVar(name){
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function labelLines(label){
  const lines = String(label ?? '').split('|').map(line=>line.trim());
  return lines.length ? lines : [''];
}

function appendMultilineText(textEl, lines, x, lineHeight){
  lines.forEach((line, i)=>{
    textEl.append('tspan')
      .attr('x', x)
      .attr('dy', i === 0 ? 0 : lineHeight)
      .text(line);
  });
}

function autoResize(ta){
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

// ═══════════════════════════════════════════════
//  RESOLVE "remaining"
// ═══════════════════════════════════════════════
function resolveRows(rawRows){
  const incoming  = {};
  const explOut   = {};
  const remSrcs   = {};

  rawRows.forEach(r=>{
    const s = (r.source||'').trim();
    const t = (r.target||'').trim();
    if(!s||!t||s===t) return;
    const vStr = (r.value+'').trim().toLowerCase();
    if(vStr==='remaining'){
      remSrcs[s] = (remSrcs[s]||0)+1;
    } else {
      const v = parseFloat(r.value);
      if(!isNaN(v)&&v>0){
        incoming[t] = (incoming[t]||0)+v;
        explOut[s]  = (explOut[s] ||0)+v;
      }
    }
  });

  const out = [];
  rawRows.forEach(r=>{
    const s = (r.source||'').trim();
    const t = (r.target||'').trim();
    if(!s||!t||s===t) return;
    const vStr = (r.value+'').trim().toLowerCase();
    if(vStr==='remaining'){
      const count  = remSrcs[s]||1;
      const avail  = (incoming[s]||0)-(explOut[s]||0);
      const val    = Math.max(0, avail/count);
      out.push({...r, source:s, target:t, resolvedValue:val, wasRemaining:true});
    } else {
      const v = parseFloat(r.value);
      if(!isNaN(v)&&v>0) out.push({...r, source:s, target:t, resolvedValue:v, wasRemaining:false});
    }
  });
  return out;
}

// ═══════════════════════════════════════════════
//  BUILD SANKEY INPUT DATA
// ═══════════════════════════════════════════════
function buildData(resolved){
  const linkMap = new Map();
  resolved.forEach(r=>{
    const k = `${r.source}\x00${r.target}`;
    if(linkMap.has(k)){
      const ex = linkMap.get(k);
      ex.resolvedValue += r.resolvedValue;
      if(!ex.color && r.color) ex.color = r.color;
    } else {
      linkMap.set(k, {...r});
    }
  });
  const dedupe = [...linkMap.values()].filter(r=>r.resolvedValue>0);

  const names   = [...new Set(dedupe.flatMap(r=>[r.source,r.target]))];
  const nodeIdx = new Map(names.map((n,i)=>[n,i]));

  return {
    nodes: names.map(name=>({name})),
    links: dedupe.map(r=>({
      source:      nodeIdx.get(r.source),
      target:      nodeIdx.get(r.target),
      value:       r.resolvedValue,
      customColor: r.color && hex(r.color) ? r.color : null,
      _src:        r.source,
      _tgt:        r.target,
    })),
  };
}

// ═══════════════════════════════════════════════
//  RENDER SANKEY
// ═══════════════════════════════════════════════
let renderTimer = null;
let graph = null;
let sankeyGen = null;
function scheduleRender(){ clearTimeout(renderTimer); renderTimer=setTimeout(doRender,40); }

function doRender(){
  graph = null;
  const resolved = resolveRows(rows);
  updateRemBadges(resolved);

  errBanner.style.display='none';
  d3.select(svgEl).selectAll('*').remove();

  if(!resolved.length){
    emptyState.style.display='flex';
    setKPIs(0,0,0,0);
    return;
  }
  emptyState.style.display='none';

  let data;
  try{ data = buildData(resolved); }
  catch(e){ showErr('Data error: '+e.message); return; }

  // Build node color override: source node name → first custom color from its outgoing links
  const nodeColorOverride = {};
  data.links.forEach(lk=>{
    if(lk.customColor && !(lk._src in nodeColorOverride)){
      nodeColorOverride[lk._src] = lk.customColor;
    }
  });
  function effNodeColor(name){
    return nodeColorOverride[name] || nodeColor(name);
  }

  const wrap = $('svgWrap');
  const W = Math.max(600, wrap.clientWidth||800);
  const H = S.h;
  const mL=130, mR=140, mT=10, mB=16;

  svgEl.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svgEl.setAttribute('width', W);
  svgEl.setAttribute('height', H);

  const alignMap = {justify:d3.sankeyJustify,left:d3.sankeyLeft,right:d3.sankeyRight,center:d3.sankeyCenter};

  let graphResult;
  try{
    const gen = d3.sankey()
      .nodeAlign(alignMap[S.align]||d3.sankeyJustify)
      .nodeWidth(S.nw)
      .nodePadding(S.pad)
      .iterations(S.iter)
      .extent([[mL,mT],[W-mR,H-mB]]);
    sankeyGen = gen;
    graphResult = gen({
      nodes: data.nodes.map(d=>({...d})),
      links: data.links.map(d=>({...d})),
    });
  } catch(e){
    showErr('Layout error: '+(e.message||'Check for cycles or duplicate paths'));
    return;
  }
  graph = graphResult;

  const svg  = d3.select(svgEl);
  const defs = svg.append('defs');
  const op   = S.op/100;

  // Max node value (used for % display mode)
  const maxNodeValue = Math.max(...graph.nodes.map(n=>n.value));

  // Build gradients
  graph.links.forEach((lk,i)=>{
    const sc = effNodeColor(lk.source.name);
    const tc = effNodeColor(lk.target.name);
    if(S.linkStyle==='gradient'){
      const g = defs.append('linearGradient')
        .attr('id',`lg${i}`)
        .attr('gradientUnits','userSpaceOnUse')
        .attr('x1',lk.source.x1).attr('x2',lk.target.x0);
      g.append('stop').attr('offset','0%').attr('stop-color',lk.customColor||sc).attr('stop-opacity',Math.min(op+0.1,0.95));
      g.append('stop').attr('offset','100%').attr('stop-color',tc).attr('stop-opacity',op);
    }
  });

  // ── LINKS ──
  const linkG = svg.append('g');
  linkG.selectAll('path')
    .data(graph.links)
    .join('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('fill','none')
      .attr('stroke',(d,i)=>{
        if(d.customColor&&S.linkStyle!=='gradient') return d.customColor;
        if(S.linkStyle==='gradient') return `url(#lg${i})`;
        if(S.linkStyle==='source')   return effNodeColor(d.source.name);
        return effNodeColor(d.target.name);
      })
      .attr('stroke-opacity', op)
      .attr('stroke-width', d=>Math.max(1,d.width))
      .style('cursor','default')
      .on('mouseenter', function(ev,d){
        d3.select(this).attr('stroke-opacity',Math.min(op+0.28,0.95));
        const pct = d.source.value>0 ? (d.value/d.source.value*100).toFixed(1)+'%' : '—';
        showTip(ev,
          `${d._src} → ${d._tgt}`,
          fmtNum(d.value),
          `${pct} of source · target total: ${fmtNum(d.target.value)}`
        );
      })
      .on('mousemove', moveTip)
      .on('mouseleave', function(ev,d){
        d3.select(this).attr('stroke-opacity',op);
        hideTip();
      });

  // ── NODES ──
  const nodeG = svg.append('g');
  const nodeGroups = nodeG.selectAll('g')
    .data(graph.nodes)
    .join('g')
    .style('cursor','grab');

  nodeGroups.append('rect')
    .attr('class','node-rect')
    .attr('x',d=>d.x0).attr('y',d=>d.y0)
    .attr('width',d=>d.x1-d.x0).attr('height',d=>d.y1-d.y0)
    .attr('fill',d=>effNodeColor(d.name))
    .attr('rx',3).attr('ry',3)
    .on('mouseenter',(ev,d)=>{
      const inV  = d.targetLinks.reduce((s,l)=>s+l.value,0);
      const outV = d.sourceLinks.reduce((s,l)=>s+l.value,0);
      const lines = [];
      if(inV>0)  lines.push(`In: <b>${fmtNum(inV)}</b>`);
      if(outV>0) lines.push(`Out: <b>${fmtNum(outV)}</b>`);
      if(!inV&&!outV) lines.push(`Value: <b>${fmtNum(d.value)}</b>`);
      showTip(ev, d.name, fmtNum(d.value), lines.join(' · '));
    })
    .on('mousemove', moveTip)
    .on('mouseleave', hideTip);

  // ── LABELS ──
  function renderNodeLabel(grp, d){
    grp.selectAll('text').remove();
    grp.selectAll('.label-bg').remove();
    const nodeH  = d.y1 - d.y0;
    const midY   = (d.y0 + d.y1) / 2;
    const onLeft = d.x0 < W / 2;
    const isInside  = S.label === 'inside' || (S.label === 'auto' && nodeH > 36);
    const valOffset = 14;
    const isLight    = document.body.classList.contains('light');
    const textColor  = isLight ? '#000000' : (cssVar('--text')  || '#EAF1FF');
    const mutedColor = isLight ? '#000000' : (cssVar('--muted') || '#A8B6CF');
    const boxBg      = isLight ? 'rgba(255,255,255,0.96)' : 'rgba(15,23,40,0.78)';
    const boxStroke  = isLight ? 'rgba(0,0,0,0.24)'      : 'rgba(234,241,255,0.18)';
    let tx, anchor, nameColor, valColor, nameSize;
    if (isInside) {
      tx = (d.x0 + d.x1) / 2; anchor = 'middle';
      nameColor = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
      valColor  = isLight ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.70)';
      nameSize  = Math.min(12, nodeH * 0.38);
    } else if (S.label === 'outside' || (S.label === 'auto' && !onLeft)) {
      tx = d.x0 - 7; anchor = 'end';
      nameColor = textColor; valColor = mutedColor; nameSize = 12;
    } else {
      tx = d.x1 + 7; anchor = 'start';
      nameColor = textColor; valColor = mutedColor; nameSize = 12;
    }
    const lines = labelLines(d.name);
    const nameLineHeight = Math.max(13, nameSize * 1.15);
    const nameStartDy = -((lines.length - 1) * nameLineHeight) / 2;
    const nameEl = grp.append('text')
      .attr('x', tx).attr('y', midY + nameStartDy)
      .attr('data-dy', nameStartDy)
      .attr('text-anchor', anchor)
      .attr('dominant-baseline', 'middle')
      .attr('fill', nameColor)
      .attr('font-family', 'DM Sans,system-ui,sans-serif')
      .attr('font-size', nameSize)
      .attr('font-weight', '700')
      .style('pointer-events', 'none');
    appendMultilineText(nameEl, lines, tx, nameLineHeight);

    let valEl = null;
    if (nodeH > 18 && S.valueMode !== 'none') {
      let valText;
      if (S.valueMode === 'percent') {
        valText = maxNodeValue > 0 ? (d.value / maxNodeValue * 100).toFixed(1) + '%' : '—';
      } else {
        valText = fmtNum(d.value);
      }
      const valueDy = nameStartDy + ((lines.length - 1) * nameLineHeight) + valOffset;
      valEl = grp.append('text')
        .attr('x', tx).attr('y', midY + valueDy)
        .attr('data-dy', valueDy)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', 'middle')
        .attr('fill', valColor)
        .attr('font-family', 'DM Mono,monospace')
        .attr('font-size', Math.min(11, nameSize - 1))
        .attr('font-weight', '400')
        .text(valText)
        .style('pointer-events', 'none');
    }
    if (S.labelBox && !isInside) {
      try {
        const pad = 5;
        const nb  = nameEl.node().getBBox();
        const vb  = valEl ? valEl.node().getBBox() : nb;
        const bx  = Math.min(nb.x, vb.x) - pad;
        const by  = nb.y - pad;
        const bw  = Math.max(nb.x + nb.width, vb.x + vb.width) - Math.min(nb.x, vb.x) + pad * 2;
        const bh  = (valEl ? vb.y + vb.height : nb.y + nb.height) - nb.y + pad * 2;
        grp.insert('rect', 'text')
          .attr('x', bx).attr('y', by)
          .attr('data-dy', by - midY)
          .attr('width', Math.max(0, bw)).attr('height', Math.max(0, bh))
          .attr('rx', 4).attr('ry', 4)
          .attr('fill', boxBg).attr('stroke', boxStroke).attr('stroke-width', 1)
          .attr('class', 'label-bg')
          .style('pointer-events', 'none');
      } catch(e) {}
    }
  }
  nodeGroups.each(function(d) { renderNodeLabel(d3.select(this), d); });

  // ── DRAG ──
  const nodeDrag = d3.drag()
    .on('start', function(event, d) {
      d3.select(this).raise().style('cursor', 'grabbing');
    })
    .on('drag', function(event, d) {
      const nodeH = d.y1 - d.y0;
      const nodeW = d.x1 - d.x0;
      d.y0 = Math.max(mT, Math.min(H - mB - nodeH, d.y0 + event.dy));
      d.y1 = d.y0 + nodeH;
      d.x0 = Math.max(0, Math.min(W - nodeW, d.x0 + event.dx));
      d.x1 = d.x0 + nodeW;
      sankeyGen.update(graph);
      const g = d3.select(this);
      g.select('.node-rect').attr('x', d.x0).attr('y', d.y0);
      renderNodeLabel(g, d);
      linkG.selectAll('path').attr('d', d3.sankeyLinkHorizontal());
      if (S.linkStyle === 'gradient') {
        graph.links.forEach((lk, i) => {
          d3.select(svgEl).select(`#lg${i}`)
            .attr('x1', lk.source.x1).attr('x2', lk.target.x0);
        });
      }
    })
    .on('end', function(event, d) {
      d3.select(this).style('cursor', 'grab');
    });
  nodeGroups.call(nodeDrag).style('touch-action', 'none');

  // ── KPIs ──
  const roots   = graph.nodes.filter(n=>n.targetLinks.length===0);
  const inflow  = roots.reduce((s,n)=>s+n.value,0);
  const maxDepth= Math.max(...graph.nodes.map(n=>n.depth||0));
  setKPIs(graph.nodes.length, graph.links.length, inflow, maxDepth+1);
}

// ═══════════════════════════════════════════════
//  TOOLTIP
// ═══════════════════════════════════════════════
function showTip(ev, title, val, sub){
  tip.innerHTML = `<div class="tt-title">${title}</div><div class="tt-val">${val}</div>${sub?`<div class="tt-row">${sub}</div>`:''}`;
  tip.classList.add('show');
  moveTip(ev);
}
function moveTip(ev){
  const pad=14, tw=tip.offsetWidth||210, th=tip.offsetHeight||80;
  let x=ev.clientX+pad, y=ev.clientY-10;
  if(x+tw>window.innerWidth-8)  x=ev.clientX-tw-pad;
  if(y+th>window.innerHeight-8) y=ev.clientY-th-pad;
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function hideTip(){ tip.classList.remove('show'); }

function showErr(msg){
  errBanner.textContent='⚠ '+msg;
  errBanner.style.display='block';
  emptyState.style.display='none';
}

function setKPIs(n,l,f,d){
  $('kNodes').textContent = n||'—';
  $('kLinks').textContent = l||'—';
  $('kFlow').textContent  = f?fmtNum(f):'—';
  $('kDepth').textContent = d||'—';
}

// ═══════════════════════════════════════════════
//  REMAINING BADGES
// ═══════════════════════════════════════════════
function updateRemBadges(resolved){
  tableBody.querySelectorAll('.rem-badge').forEach(b=>{ b.style.display='none'; b.textContent=''; });
  resolved.forEach(r=>{
    if(!r.wasRemaining) return;
    tableBody.querySelectorAll('.rem-badge').forEach(b=>{
      if(b.dataset.src===r.source && b.dataset.tgt===r.target){
        b.textContent = '= '+fmtNum(r.resolvedValue);
        b.style.display = 'inline-block';
      }
    });
  });
}

// ═══════════════════════════════════════════════
//  TABLE EDITOR – BUILD UI ROWS
// ═══════════════════════════════════════════════
function buildTableRows(){
  tableBody.innerHTML = '';
  rows.forEach((r,i) => tableBody.appendChild(makeTableRow(r,i)));
}

function makeTableRow(r, i){
  const tr = document.createElement('tr');
  tr.dataset.idx = i;

  // From cell
  const tdFrom = document.createElement('td');
  const taFrom = document.createElement('textarea');
  taFrom.className = 'tc-inp tc-from';
  taFrom.value = r.source || '';
  taFrom.rows = 1;
  taFrom.placeholder = 'Source';
  tdFrom.appendChild(taFrom);
  tr.appendChild(tdFrom);

  // To cell
  const tdTo = document.createElement('td');
  const taTo = document.createElement('textarea');
  taTo.className = 'tc-inp tc-to';
  taTo.value = r.target || '';
  taTo.rows = 1;
  taTo.placeholder = 'Target';
  tdTo.appendChild(taTo);
  tr.appendChild(tdTo);

  // Amount cell (with rem-badge)
  const tdAmt = document.createElement('td');
  tdAmt.className = 'td-amt';
  const amtWrap = document.createElement('div');
  amtWrap.className = 'td-amt-cell';
  const inpAmt = document.createElement('input');
  inpAmt.type = 'text';
  inpAmt.className = 'tc-inp tc-amt';
  inpAmt.value = r.value || '';
  inpAmt.placeholder = 'Value';
  const badge = document.createElement('span');
  badge.className = 'rem-badge';
  badge.dataset.src = r.source || '';
  badge.dataset.tgt = r.target || '';
  const isRem = (r.value+'').trim().toLowerCase() === 'remaining';
  badge.style.display = isRem ? 'inline-block' : 'none';
  amtWrap.appendChild(inpAmt);
  amtWrap.appendChild(badge);
  tdAmt.appendChild(amtWrap);
  tr.appendChild(tdAmt);

  // Color cell
  const hasC = r.color && hex(r.color);
  const tdColor = document.createElement('td');
  tdColor.className = 'td-color';
  const colorCell = document.createElement('div');
  colorCell.className = 'color-cell' + (hasC ? ' has-color' : '');
  const colorPick = document.createElement('input');
  colorPick.type = 'color';
  colorPick.className = 'row-color';
  colorPick.value = hasC ? r.color : '#8DBBFF';
  if(!hasC){ colorPick.style.opacity='0.35'; colorPick.title='Click to set custom colour'; }
  const clearBtn = document.createElement('button');
  clearBtn.className = 'color-clear';
  clearBtn.title = 'Remove custom colour';
  clearBtn.textContent = '×';
  colorCell.appendChild(colorPick);
  colorCell.appendChild(clearBtn);
  tdColor.appendChild(colorCell);
  tr.appendChild(tdColor);

  // Del cell
  const tdDel = document.createElement('td');
  tdDel.className = 'td-del';
  const delBtn = document.createElement('button');
  delBtn.className = 'del-btn';
  delBtn.title = 'Remove row';
  delBtn.innerHTML = '✕';
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  // Auto-resize textareas on init
  requestAnimationFrame(()=>{ autoResize(taFrom); autoResize(taTo); });

  // Events
  [taFrom, taTo].forEach(ta=>{
    ta.addEventListener('input', ()=>{
      autoResize(ta);
      readFromEditor(); syncText(); scheduleRender();
    });
  });

  inpAmt.addEventListener('input', ()=>{
    readFromEditor(); syncText(); scheduleRender();
  });

  colorPick.addEventListener('input', ()=>{
    rows[i].color = colorPick.value;
    colorCell.classList.add('has-color');
    colorPick.style.opacity = '1';
    colorPick.title = '';
    syncText(); scheduleRender();
  });

  clearBtn.addEventListener('click', ()=>{
    rows[i].color = '';
    colorCell.classList.remove('has-color');
    colorPick.style.opacity = '0.35';
    colorPick.title = 'Click to set custom colour';
    syncText(); scheduleRender();
  });

  delBtn.addEventListener('click', ()=>{
    rows.splice(i, 1);
    buildTableRows(); syncText(); scheduleRender();
  });

  return tr;
}

function readFromEditor(){
  const trs = tableBody.querySelectorAll('tr[data-idx]');
  trs.forEach((tr, i)=>{
    if(!rows[i]) rows[i] = {source:'',target:'',value:'',color:''};
    rows[i].source = tr.querySelector('.tc-from').value.trim();
    rows[i].target = tr.querySelector('.tc-to').value.trim();
    rows[i].value  = tr.querySelector('.tc-amt').value.trim();
    const badge = tr.querySelector('.rem-badge');
    if(badge){
      badge.dataset.src = rows[i].source;
      badge.dataset.tgt = rows[i].target;
      const isNowRem = rows[i].value.trim().toLowerCase() === 'remaining';
      badge.style.display = isNowRem ? 'inline-block' : 'none';
      if(!isNowRem) badge.textContent = '';
    }
  });
}

// ═══════════════════════════════════════════════
//  TEXT TAB SYNC
// ═══════════════════════════════════════════════
function rowsToText(rr){
  return rr.map(r=>{
    const parts = [r.source, r.target, r.value];
    if(r.color && hex(r.color)) parts.push(r.color);
    return parts.join(',');
  }).join('\n');
}

function syncText(){
  txtIn.value = rowsToText(rows);
}

function parseText(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  const result=[];
  const errs=[];
  lines.forEach((line,li)=>{
    const parts = line.split(',').map(p=>p.trim());
    if(parts.length<3){ errs.push(`Line ${li+1}: needs at least source,target,value`); return; }
    const [source,target,value,...rest]=parts;
    const color = rest.find(p=>hex(p))||'';
    result.push({source,target,value,color});
  });
  return {rows:result, errors:errs};
}

let textTimer=null;
txtIn.addEventListener('input',()=>{
  clearTimeout(textTimer);
  $('textStatus').innerHTML='';
  textTimer=setTimeout(()=>{
    const {rows:parsed, errors} = parseText(txtIn.value);
    if(errors.length){
      $('textStatus').innerHTML=`<span class="status-err">⚠ ${errors[0]}</span>`;
    } else {
      $('textStatus').innerHTML=`<span class="status-ok">✓ ${parsed.length} row${parsed.length!==1?'s':''}</span>`;
    }
    rows = parsed;
    buildTableRows();
    scheduleRender();
  }, 300);
});

// ═══════════════════════════════════════════════
//  CSV
// ═══════════════════════════════════════════════
function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return [];
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('source')||first.includes('target')||first.includes('from')||first.includes('to');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map(line=>{
    const parts = line.split(',').map(p=>p.replace(/^["']|["']$/g,'').trim());
    const [source='',target='',value='',...rest]=parts;
    const color = rest.find(p=>hex(p))||'';
    return {source,target,value,color};
  }).filter(r=>r.source&&r.target&&r.value);
}

function handleFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    const parsed = parseCSV(e.target.result);
    if(!parsed.length){
      $('csvStatus').innerHTML='<span class="status-err">⚠ No valid rows found</span>';
      return;
    }
    rows = parsed;
    buildTableRows();
    syncText();
    scheduleRender();
    $('csvStatus').innerHTML=`<span class="status-ok">✓ Loaded ${parsed.length} rows from ${file.name}</span>`;
  };
  reader.readAsText(file);
}

$('csvFile').addEventListener('change', e=>handleFile(e.target.files[0]));

const csvDrop = $('csvDrop');
csvDrop.addEventListener('dragover', e=>{e.preventDefault();csvDrop.classList.add('dragover');});
csvDrop.addEventListener('dragleave',()=>csvDrop.classList.remove('dragover'));
csvDrop.addEventListener('drop', e=>{
  e.preventDefault(); csvDrop.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});
csvDrop.addEventListener('click', ()=>$('csvFile').click());

$('downloadTemplate').addEventListener('click',()=>{
  const tpl = `source,target,value,color
Website,Homepage,1000,
Website,Other Pages,500,
Homepage,Sign Up,300,
Homepage,Bounce,remaining,#FF8B8B
Other Pages,Sign Up,100,
Other Pages,Bounce,remaining,#FF8B8B
Sign Up,Converted,180,#8FCDBD
Sign Up,Dropped,remaining,`;
  const blob=new Blob([tpl],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='sankey_template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* Sanitise CSV text to plain ASCII so spreadsheets never render mojibake
   (â€” / Î” / âˆ’). Cosmetic glyphs are deleted; functional glyphs are replaced
   with a safe ASCII equivalent that preserves their meaning:
     - minus sign (−) and en dash (–) → "-"   (negative values stay negative)
     - delta (Δ)                      → "Delta"
     - emoji / pictographs            → removed (cosmetic)
     - em dash (—), figure dash, bar  → removed (cosmetic separators) */
function cleanCSV(text){
  return String(text||'')
    .replace(/[–−]/g, '-')
    .replace(/Δ/g, 'Delta')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[ \t]*[‒—―][ \t]*/g, ' ');
}

// ─── Download current work as CSV ───
$('downloadCsvBtn').addEventListener('click',()=>{
  const header = 'source,target,value,color';
  const dataRows = rows.map(r=>{
    const color = r.color && hex(r.color) ? r.color : '';
    // Wrap fields containing commas in quotes
    const esc = v => (v+'').includes(',') ? `"${v}"` : v;
    return [esc(r.source), esc(r.target), esc(r.value), color].join(',');
  }).join('\n');
  const csv = cleanCSV('# Made using tool.adjiebrotots.com/sankeycreator\n' + header + '\n' + dataRows);
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sankey_data.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

// ═══════════════════════════════════════════════
//  ADD ROW
// ═══════════════════════════════════════════════
$('addRowBtn').addEventListener('click',()=>{
  rows.push({source:'',target:'',value:'',color:''});
  buildTableRows();
  syncText();
  const last = tableBody.lastElementChild;
  if(last){
    last.scrollIntoView({behavior:'smooth',block:'nearest'});
    last.querySelector('.tc-from').focus();
  }
});

// ═══════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════
document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
  });
});

// ─── Data sub-tabs ───
document.querySelectorAll('.data-sub-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const sub = btn.dataset.sub;
    document.querySelectorAll('.data-sub-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.data-sub-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('sub-'+sub).classList.add('active');

    if(sub === 'text'){
      syncText();
    }
    if(sub === 'table'){
      clearTimeout(textTimer);
      const {rows:parsed} = parseText(txtIn.value);
      if(parsed.length){ rows = parsed; }
      buildTableRows();
    }
  });
});

// ═══════════════════════════════════════════════
//  STYLE CONTROLS
// ═══════════════════════════════════════════════
function bindSlider(id, valId, key, fmt, onInput){
  const el=$('s'+id), vEl=$(valId);
  el.addEventListener('input',()=>{
    S[key]=parseFloat(el.value);
    if(vEl) vEl.textContent=fmt(el.value);
    onInput&&onInput();
    scheduleRender();
  });
}
bindSlider('Pad','vPad','pad', v=>v,    null);
bindSlider('NW', 'vNW', 'nw',  v=>v+'px', null);
bindSlider('Op', 'vOp', 'op',  v=>v+'%',  null);
bindSlider('H',  'vH',  'h',   v=>v+'px', null);

$('sColor').addEventListener('change',()=>{ S.scheme=$('sColor').value; scheduleRender(); });
$('sLabel').addEventListener('change',()=>{ S.label=$('sLabel').value;  scheduleRender(); });
$('sLinkStyle').addEventListener('change',()=>{ S.linkStyle=$('sLinkStyle').value; scheduleRender(); });
$('sIter').addEventListener('change',()=>{ S.iter=parseInt($('sIter').value); scheduleRender(); });
$('sLabelBox').addEventListener('change',()=>{ S.labelBox=$('sLabelBox').checked; scheduleRender(); });

document.querySelectorAll('input[name="align"]').forEach(r=>{
  r.addEventListener('change',()=>{ S.align=r.value; scheduleRender(); });
});

document.querySelectorAll('input[name="valueMode"]').forEach(r=>{
  r.addEventListener('change',()=>{ S.valueMode=r.value; scheduleRender(); });
});

// ═══════════════════════════════════════════════
//  RESET / CLEAR
// ═══════════════════════════════════════════════
$('resetBtn').addEventListener('click',()=>{
  rows = clone(DEFAULT_ROWS);
  S    = clone(DEFAULT_S);
  $('sPad').value=S.pad;       $('vPad').textContent=S.pad;
  $('sNW').value=S.nw;         $('vNW').textContent=S.nw+'px';
  $('sOp').value=S.op;         $('vOp').textContent=S.op+'%';
  $('sH').value=S.h;           $('vH').textContent=S.h+'px';
  $('sColor').value=S.scheme;
  $('sLabel').value=S.label;
  $('sLinkStyle').value=S.linkStyle;
  $('sIter').value=S.iter;
  $('sLabelBox').checked=S.labelBox;
  document.querySelector(`input[name="align"][value="${S.align}"]`).checked=true;
  document.querySelector(`input[name="valueMode"][value="${S.valueMode}"]`).checked=true;
  buildTableRows();
  syncText();
  scheduleRender();
});

$('clearBtn').addEventListener('click',()=>{
  rows=[{source:'',target:'',value:'',color:''}];
  buildTableRows();
  syncText();
  scheduleRender();
});

// ═══════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  scheduleRender();
});

// ═══════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════
function exportCloneXml(){
  const clone = svgEl.cloneNode(true);
  clone.querySelectorAll('text').forEach(t => t.setAttribute('fill','#1a1a1a'));
  clone.querySelectorAll('.label-bg').forEach(r => r.setAttribute('fill','rgba(255,255,255,0.88)'));
  const W = svgEl.viewBox.baseVal.width || 800;
  const H = svgEl.viewBox.baseVal.height || S.h;
  const titleText = (document.getElementById('diagramTitle')?.value || '').trim();
  const TITLE_H = titleText ? 36 : 0;

  // Expand viewBox to accommodate title at top and watermark at bottom
  clone.setAttribute('viewBox', `0 ${-TITLE_H} ${W} ${H + TITLE_H}`);
  clone.setAttribute('height', H + TITLE_H);

  if(titleText){
    const titleEl = document.createElementNS('http://www.w3.org/2000/svg','text');
    titleEl.setAttribute('x', W / 2); titleEl.setAttribute('y', -10);
    titleEl.setAttribute('text-anchor','middle');
    titleEl.setAttribute('font-family','DM Sans, sans-serif');
    titleEl.setAttribute('font-size','16');
    titleEl.setAttribute('font-weight','700');
    titleEl.setAttribute('fill','#1a1a1a');
    titleEl.textContent = titleText;
    clone.insertBefore(titleEl, clone.firstChild);
  }

  // Watermark text is baked to glyph outlines (WM_PATH) so the exported
  // SVG carries no editable/searchable string; renders identically.
  const wm = document.createElementNS('http://www.w3.org/2000/svg','path');
  wm.setAttribute('d', WM_PATH);
  wm.setAttribute('transform', 'translate(' + (W - 12 - WM_PATH_W) + ',' + (H - 10) + ')');
  wm.setAttribute('fill','#1a1a1a');
  wm.setAttribute('opacity','0.22');
  clone.appendChild(wm);
  const wmLogoSize = 13;
  const wmTextW = WM_PATH_W;
  const wmLogo = document.createElementNS('http://www.w3.org/2000/svg','image');
  wmLogo.setAttribute('href', WM_LOGO_SRC);
  wmLogo.setAttributeNS('http://www.w3.org/1999/xlink','href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize);
  wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', W - 12 - wmTextW - 4 - wmLogoSize);
  wmLogo.setAttribute('y', H - 10 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  clone.appendChild(wmLogo);
  return new XMLSerializer().serializeToString(clone);
}

$('exportSvgBtn').addEventListener('click',()=>{
  if(!graph) return;
  const xml  = exportCloneXml();
  const blob = new Blob([xml],{type:'image/svg+xml'});
  const a    = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sankey.svg';
  a.click();
  URL.revokeObjectURL(a.href);
});

function renderSankeyPngCanvas() {
  if(!graph) return Promise.resolve(null);
  const W  = svgEl.viewBox.baseVal.width  || 800;
  const H  = svgEl.viewBox.baseVal.height || S.h;
  const xml    = exportCloneXml();
  // exportCloneXml already includes title in viewBox expansion — render the full exported SVG
  const svgB64 = 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml)));
  const titleText = (document.getElementById('diagramTitle')?.value || '').trim();
  const TITLE_H = titleText ? 36 : 0;
  const TOTAL_H = H + TITLE_H;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width = W*3; canvas.height = TOTAL_H*3;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(3,3);
      ctx.drawImage(img,0,0,W,TOTAL_H);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Could not render PNG.'));
    img.src=svgB64;
  });
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
$('exportPngBtn').addEventListener('click', async()=>{
  const canvas = await renderSankeyPngCanvas();
  if(!canvas) return;
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download='sankey.png';
  a.click();
});
$('copyPngBtn').addEventListener('click', async()=>{
  try {
    const canvas = await renderSankeyPngCanvas();
    if(!canvas) return;
    await copyCanvasPngToClipboard(canvas);
    alert('PNG copied to clipboard.');
  } catch(err) { alert('PNG copy failed: ' + err.message); }
});

// ═══════════════════════════════════════════════
//  RESIZE OBSERVER
// ═══════════════════════════════════════════════
const ro = new ResizeObserver(()=>scheduleRender());
ro.observe($('svgWrap'));

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
function makeSliderEditable(valSpan,rangeEl){
  if(!valSpan||!rangeEl)return;
  const inp=document.createElement('input');
  inp.type='text';inp.className='slider-val-edit';
  valSpan.parentNode.insertBefore(inp,valSpan.nextSibling);
  valSpan.addEventListener('click',()=>{
    inp.value=parseFloat(rangeEl.value);
    valSpan.style.display='none';inp.style.display='inline';
    inp.focus();inp.select();
  });
  function commit(){
    const raw=parseFloat(inp.value);
    if(!isNaN(raw)){
      const mn=parseFloat(rangeEl.min),mx=parseFloat(rangeEl.max),st=parseFloat(rangeEl.step)||1;
      const v=+(Math.round(Math.min(mx,Math.max(mn,raw))/st)*st).toFixed(10);
      rangeEl.value=v;
      rangeEl.dispatchEvent(new Event('input',{bubbles:true}));
    }
    inp.style.display='none';valSpan.style.display='';
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}else if(e.key==='Escape'){inp.value='';commit();}});
}
[['sPad','vPad'],['sNW','vNW'],['sOp','vOp'],['sH','vH']
].forEach(([rid,vid])=>makeSliderEditable($(vid),$(rid)));

buildTableRows();
syncText();
scheduleRender();

})();
