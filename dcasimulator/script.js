(function(){
'use strict';
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
// Watermark wordmark ("Made using tool.adjiebrotots.com/dcasimulator") baked to DM Sans 500 glyph
// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.
const WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM182.5 0.13Q181.73 0.13 181.14 -0.25Q180.54 -0.64 180.21 -1.31Q179.88 -1.99 179.88 -2.84Q179.88 -3.71 180.22 -4.38Q180.55 -5.05 181.15 -5.43Q181.75 -5.82 182.54 -5.82Q183.19 -5.82 183.67 -5.56Q184.15 -5.31 184.42 -4.84V-7.92H185.52V0H184.54L184.43 -0.87Q184.26 -0.61 184 -0.38Q183.74 -0.15 183.37 -0.01Q183 0.13 182.5 0.13ZM182.71 -0.82Q183.22 -0.82 183.61 -1.07Q183.99 -1.32 184.2 -1.78Q184.42 -2.23 184.42 -2.84Q184.42 -3.46 184.2 -3.91Q183.99 -4.37 183.61 -4.61Q183.22 -4.86 182.71 -4.86Q182.22 -4.86 181.83 -4.61Q181.44 -4.37 181.22 -3.91Q181.01 -3.46 181.01 -2.85Q181.01 -2.23 181.22 -1.78Q181.44 -1.32 181.83 -1.07Q182.22 -0.82 182.71 -0.82ZM189.6 0.13Q188.8 0.13 188.17 -0.24Q187.55 -0.62 187.19 -1.29Q186.84 -1.95 186.84 -2.83Q186.84 -3.73 187.19 -4.4Q187.55 -5.07 188.17 -5.44Q188.8 -5.82 189.6 -5.82Q190.62 -5.82 191.3 -5.28Q191.98 -4.75 192.17 -3.83H191.03Q190.92 -4.33 190.52 -4.6Q190.13 -4.88 189.59 -4.88Q189.13 -4.88 188.76 -4.64Q188.39 -4.41 188.17 -3.96Q187.96 -3.51 187.96 -2.84Q187.96 -2.35 188.08 -1.97Q188.2 -1.58 188.42 -1.32Q188.64 -1.07 188.94 -0.93Q189.24 -0.8 189.59 -0.8Q189.96 -0.8 190.25 -0.92Q190.55 -1.05 190.75 -1.29Q190.96 -1.53 191.03 -1.86H192.17Q191.99 -0.96 191.3 -0.41Q190.61 0.13 189.6 0.13ZM195.32 0.13Q194.65 0.13 194.21 -0.11Q193.76 -0.35 193.54 -0.75Q193.32 -1.15 193.32 -1.62Q193.32 -2.17 193.6 -2.56Q193.89 -2.96 194.41 -3.17Q194.94 -3.38 195.67 -3.38H197.09Q197.09 -3.89 196.97 -4.23Q196.84 -4.57 196.56 -4.74Q196.29 -4.9 195.83 -4.9Q195.36 -4.9 195.02 -4.68Q194.69 -4.45 194.6 -4H193.5Q193.57 -4.58 193.89 -4.98Q194.21 -5.39 194.73 -5.6Q195.24 -5.82 195.83 -5.82Q196.61 -5.82 197.14 -5.54Q197.67 -5.27 197.93 -4.77Q198.19 -4.27 198.19 -3.58V0H197.23L197.14 -0.94Q197.03 -0.72 196.86 -0.52Q196.69 -0.33 196.47 -0.18Q196.24 -0.03 195.95 0.05Q195.67 0.13 195.32 0.13ZM195.52 -0.76Q195.86 -0.76 196.15 -0.91Q196.43 -1.05 196.63 -1.31Q196.84 -1.56 196.95 -1.87Q197.06 -2.19 197.07 -2.54V-2.6H195.78Q195.32 -2.6 195.03 -2.49Q194.74 -2.37 194.61 -2.16Q194.48 -1.95 194.48 -1.69Q194.48 -1.4 194.6 -1.2Q194.72 -0.99 194.96 -0.88Q195.19 -0.76 195.52 -0.76ZM201.82 0.13Q201.05 0.13 200.53 -0.11Q200 -0.34 199.72 -0.77Q199.43 -1.19 199.38 -1.75H200.49Q200.54 -1.48 200.69 -1.26Q200.84 -1.03 201.12 -0.9Q201.4 -0.76 201.82 -0.76Q202.17 -0.76 202.41 -0.87Q202.65 -0.97 202.78 -1.16Q202.9 -1.34 202.9 -1.58Q202.9 -1.9 202.75 -2.07Q202.6 -2.25 202.31 -2.35Q202.02 -2.44 201.6 -2.5Q201.15 -2.58 200.78 -2.69Q200.4 -2.81 200.13 -3Q199.86 -3.19 199.71 -3.48Q199.56 -3.77 199.56 -4.17Q199.56 -4.65 199.82 -5.02Q200.08 -5.4 200.55 -5.61Q201.03 -5.82 201.69 -5.82Q202.64 -5.82 203.2 -5.38Q203.76 -4.95 203.86 -4.16H202.79Q202.74 -4.52 202.45 -4.72Q202.16 -4.92 201.68 -4.92Q201.18 -4.92 200.92 -4.74Q200.66 -4.55 200.66 -4.24Q200.66 -4.02 200.78 -3.85Q200.91 -3.68 201.2 -3.56Q201.49 -3.44 201.94 -3.37Q202.59 -3.27 203.05 -3.1Q203.52 -2.93 203.77 -2.59Q204.02 -2.26 204.01 -1.66Q204.02 -1.1 203.74 -0.7Q203.47 -0.3 202.98 -0.08Q202.48 0.13 201.82 0.13ZM205.43 0V-5.69H206.53V0ZM205.98 -6.69Q205.66 -6.69 205.46 -6.89Q205.25 -7.09 205.25 -7.39Q205.25 -7.69 205.46 -7.88Q205.66 -8.07 205.98 -8.07Q206.29 -8.07 206.5 -7.88Q206.71 -7.69 206.71 -7.39Q206.71 -7.09 206.5 -6.89Q206.29 -6.69 205.98 -6.69ZM208.13 0V-5.69H209.11L209.18 -4.91Q209.44 -5.33 209.89 -5.58Q210.33 -5.82 210.86 -5.82Q211.27 -5.82 211.61 -5.71Q211.95 -5.59 212.2 -5.37Q212.46 -5.14 212.61 -4.8Q212.91 -5.29 213.4 -5.55Q213.89 -5.82 214.45 -5.82Q215.11 -5.82 215.58 -5.56Q216.05 -5.3 216.3 -4.78Q216.54 -4.27 216.54 -3.5V0H215.45V-3.39Q215.45 -4.13 215.14 -4.51Q214.82 -4.88 214.25 -4.88Q213.86 -4.88 213.55 -4.68Q213.24 -4.49 213.07 -4.1Q212.89 -3.72 212.89 -3.17V0H211.79V-3.39Q211.79 -4.13 211.47 -4.51Q211.15 -4.88 210.58 -4.88Q210.21 -4.88 209.9 -4.68Q209.59 -4.49 209.41 -4.1Q209.23 -3.72 209.23 -3.17V0ZM220.1 0.13Q219.45 0.13 218.98 -0.12Q218.5 -0.37 218.24 -0.88Q217.98 -1.4 217.98 -2.16V-5.69H219.08V-2.29Q219.08 -1.54 219.43 -1.17Q219.78 -0.8 220.4 -0.8Q220.82 -0.8 221.15 -1Q221.49 -1.19 221.69 -1.56Q221.88 -1.94 221.88 -2.48V-5.69H222.98V0H222L221.93 -0.92Q221.69 -0.43 221.21 -0.15Q220.74 0.13 220.1 0.13ZM224.52 0V-7.92H225.62V0ZM228.97 0.13Q228.3 0.13 227.85 -0.11Q227.41 -0.35 227.19 -0.75Q226.97 -1.15 226.97 -1.62Q226.97 -2.17 227.25 -2.56Q227.53 -2.96 228.06 -3.17Q228.59 -3.38 229.32 -3.38H230.74Q230.74 -3.89 230.62 -4.23Q230.49 -4.57 230.21 -4.74Q229.94 -4.9 229.48 -4.9Q229 -4.9 228.67 -4.68Q228.33 -4.45 228.25 -4H227.15Q227.22 -4.58 227.54 -4.98Q227.86 -5.39 228.37 -5.6Q228.89 -5.82 229.48 -5.82Q230.26 -5.82 230.79 -5.54Q231.31 -5.27 231.58 -4.77Q231.84 -4.27 231.84 -3.58V0H230.88L230.79 -0.94Q230.68 -0.72 230.51 -0.52Q230.34 -0.33 230.12 -0.18Q229.89 -0.03 229.6 0.05Q229.32 0.13 228.97 0.13ZM229.17 -0.76Q229.51 -0.76 229.79 -0.91Q230.08 -1.05 230.28 -1.31Q230.49 -1.56 230.6 -1.87Q230.71 -2.19 230.72 -2.54V-2.6H229.43Q228.97 -2.6 228.68 -2.49Q228.39 -2.37 228.26 -2.16Q228.13 -1.95 228.13 -1.69Q228.13 -1.4 228.25 -1.2Q228.37 -0.99 228.61 -0.88Q228.84 -0.76 229.17 -0.76ZM235.65 0Q235.13 0 234.74 -0.16Q234.35 -0.33 234.15 -0.71Q233.94 -1.1 233.94 -1.76V-4.76H232.95V-5.69H233.94L234.07 -7.14H235.04V-5.69H236.62V-4.76H235.04V-1.75Q235.04 -1.28 235.23 -1.11Q235.43 -0.94 235.92 -0.94H236.6V0ZM240.41 0.13Q239.61 0.13 238.99 -0.24Q238.37 -0.61 238.02 -1.28Q237.67 -1.95 237.67 -2.84Q237.67 -3.74 238.02 -4.41Q238.38 -5.08 239 -5.45Q239.63 -5.82 240.43 -5.82Q241.23 -5.82 241.85 -5.45Q242.47 -5.08 242.82 -4.41Q243.17 -3.74 243.17 -2.84Q243.17 -1.95 242.82 -1.28Q242.46 -0.61 241.84 -0.24Q241.22 0.13 240.41 0.13ZM240.41 -0.81Q240.87 -0.81 241.24 -1.04Q241.61 -1.27 241.83 -1.72Q242.05 -2.17 242.05 -2.84Q242.05 -3.52 241.83 -3.97Q241.62 -4.42 241.25 -4.65Q240.89 -4.87 240.43 -4.87Q239.98 -4.87 239.61 -4.65Q239.23 -4.42 239.01 -3.97Q238.79 -3.52 238.79 -2.84Q238.79 -2.17 239.01 -1.72Q239.23 -1.27 239.59 -1.04Q239.96 -0.81 240.41 -0.81ZM244.49 0V-5.69H245.48L245.57 -4.65Q245.77 -5.03 246.08 -5.29Q246.39 -5.55 246.82 -5.68Q247.26 -5.82 247.79 -5.82V-4.66H247.25Q246.92 -4.66 246.62 -4.58Q246.32 -4.5 246.09 -4.3Q245.86 -4.11 245.72 -3.79Q245.59 -3.46 245.59 -2.96V0Z";
const WM_PATH_W = 248.07;
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

/* ─── CONSTANTS ─── */
const LINE_COLORS     = ['--line-a','--line-b','--line-c','--line-d','--line-e','--line-f'];
const LINE_COLOR_HEX  = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4'];
const COLOR_NAMES     = ['Blue','Red','Green','Gold','Purple','Cyan'];
const DATE_BASED_STYLES = ['monthly-date','weekly-day'];
const FORWARD_STYLES    = ['monthly-top','monthly-bottom','weekly-top','weekly-bottom'];
const MOMENTUM_STYLES   = ['momentum-peak','momentum-dip'];
const TECH_STYLES       = ['tech-ma-cross','tech-rsi','tech-bollinger','tech-macd-cross','tech-macd-hist','tech-adx'];
const STYLE_ORDER = [...DATE_BASED_STYLES, ...MOMENTUM_STYLES, ...TECH_STYLES, ...FORWARD_STYLES];
// Oscillator-style indicators each get their own grid stacked below the price
// chart, grouped by indicator family so e.g. RSI (0-100) and MACD (near 0)
// never share a scale and squash each other.
const OSC_GROUPS = {
  'tech-rsi':        {key:'rsi',  name:'RSI'},
  'tech-macd-cross': {key:'macd', name:'MACD'},
  'tech-macd-hist':  {key:'macd', name:'MACD'},
  'tech-adx':        {key:'adx',  name:'ADX'}
};
const WEEKDAY_OPTIONS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
// MACD histogram bar colours — the TradingView-style 4-colour scheme: a
// saturated shade while a bar grows away from the zero line and a faded shade
// while it shrinks back toward it (green above zero, red below).
const MACD_HIST_COLORS = {
  upStrong:'#26a69a', upFaint:'rgba(38,166,154,0.42)',
  downStrong:'#ef5350', downFaint:'rgba(239,83,80,0.42)'
};
// Candlestick body/wick colours (up = close ≥ open, down = close < open).
const CANDLE_UP = '#26a69a', CANDLE_DOWN = '#ef5350';
const DEFAULT_RANDOM_SEED = 25823952204;
// Tickers are pooled and fetched once over a wide window so later date-range
// tweaks reuse the cache instead of hitting the Worker again. Yahoo/Stooq simply
// return each instrument's available history within this window.
const POOL_FETCH_START = '1990-01-01';
// Shared with the Portfolio tool (same origin, same key) so prices cached on one
// page are reused on the other. Bumped to v2 when the shared format landed.
const CACHE_STORAGE_KEY = 'dca_priceCache_v2';

/* ─── STATE ─── */
let securities = [];
let simResults = [];
let latestRows = [];
let priceChartInstance = null;
let equityChartInstance = null;
let activeDetailSec = 0;
let showDeposited = true;
let showTechIndicators = false;
let showBuyDates = false;
let showAdvanced = false;       // Final Summary: reveal Sharpe/Sortino/Treynor/CAGR rows
// Security-prices chart view state. Each scenario is an independent series;
// by default only the first is visible (the rest can be toggled on). The chart
// shows actual prices when one series is visible and normalises to 100 when two
// or more are compared. Candlestick mode always shows actual OHLC.
let showCandles = false;
let priceHidden = new Set();   // price-chart series indices currently hidden
let priceSeriesCount = -1;     // last series count → reset "first only" default on change
let currentCurrencySymbol = '$';
let secIdCounter = 0;
let activeSecurityId = null;   // the scenario currently being edited in the sidebar
let runDebounceTimer = null;
let currentRandomSeed = DEFAULT_RANDOM_SEED;

/* ─── PRICE CACHE ─── */
// Keyed by ticker. Stores the widest date range ever fetched so simulations
// can filter from memory without re-fetching (only expand when needed).
let priceCache = {};
// { 'AAPL': { dates: [...], prices: [...], cachedStart: 'YYYY-MM-DD', cachedEnd: 'YYYY-MM-DD' } }
let tickerFetchInFlight = {};

/* ─── HELPERS ─── */
const $ = id => document.getElementById(id);
function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }
function getSecColor(sec){ return sec.colorHex || cssVar(sec.colorVar); }
// Returns a related, semi-transparent shade of a colour so an indicator line
// reads as belonging to its security while staying distinct from the price line.
function withAlpha(c,a){
  if(typeof c==='string'){
    const m=c.match(/^#([0-9a-fA-F]{6})$/);
    if(m){ const h=Math.round(Math.max(0,Math.min(1,a))*255).toString(16).padStart(2,'0'); return '#'+m[1]+h; }
  }
  return c;
}
// Per-bar colours for a MACD histogram: saturated while a bar grows away from
// the zero line, faded while it shrinks back toward it (green ≥0, red <0) — the
// standard 4-colour MACD histogram scheme.
function macdHistColors(values){
  const c=MACD_HIST_COLORS;
  let prev=null;
  return values.map(v=>{
    if(v==null) return 'transparent';
    const growing = prev==null ? true : (v>=0 ? v>=prev : v<=prev);
    prev=v;
    if(v>=0) return growing ? c.upStrong : c.upFaint;
    return growing ? c.downStrong : c.downFaint;
  });
}
function showStatus(el, msg, type){
  if(!el) return;
  el.className = 'status-bar status-'+type;
  el.innerHTML = (type==='loading'?'<span class="spinner"></span>':'')+msg;
}
function hideStatus(el){ if(!el) return; el.className='status-bar'; el.textContent=''; }

function scheduleRun(){ /* no-op – simulation is manual via ▶ Simulate */ }

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
function getActiveTab(){ const t=document.querySelector('.ctrl-tab.active'); return t?t.dataset.tab:'securities'; }
function updateSimBtn(){ const b=$('simBtn'); if(!b)return; b.textContent='▶ Simulate'; updateBtnRow(); }
// On the Data tab the bottom action becomes "Load tickers" (it consumes the Date
// Range below and you can't simulate from here anyway); other tabs show Simulate/Reset.
function updateBtnRow(){
  const dataTab = getActiveTab()==='data';
  ['simBtn','resetBtn'].forEach(id=>{ const b=$(id); if(b) b.style.display=dataTab?'none':''; });
  const lb=$('loadTickersBtn'); if(lb) lb.style.display=dataTab?'':'none';
}
function sanitizeSeed(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return DEFAULT_RANDOM_SEED;
  return Math.floor(Math.abs(n));
}

const fmt = {
  currency(v, compact=false){
    const sym=currentCurrencySymbol;
    const n=Number(v||0), abs=Math.abs(n), sign=n<0?'−':'';
    if(compact&&abs>=1e9) return sign+sym+(abs/1e9).toFixed(2)+'b';
    if(compact&&abs>=1e6) return sign+sym+(abs/1e6).toFixed(2)+'m';
    if(compact&&abs>=1e3) return sign+sym+(abs/1e3).toFixed(0)+'k';
    return sign+sym+Math.round(abs).toLocaleString('en-US');
  },
  pct(v,d=2){ const n=Number(v||0); return (Math.abs(n)<=1?n*100:n).toFixed(d)+'%'; },
  num(v,d=0){ return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); },
  date(d){ return d instanceof Date ? d.toISOString().slice(0,10) : d; },
};

/* ─── ADVANCED METRICS ───
   Risk/return statistics shown in the Final Summary when "Advanced metrics" is on.
   - Sharpe / Sortino use daily time-weighted (price) returns; the risk-free rate
     is assumed to be 0 (this tool has no rf input).
   - Treynor uses beta vs. the equal-weighted average of all simulated series
     (a cross-sectional "market" proxy); a lone security has beta ≈ 1.
   - CAGR (TWR) annualises the geometric price return (cash-flow neutral).
   - CAGR (MWR) is the annualised IRR of actual deposits → final equity. */
const TRADING_DAYS = 252;
function dailyReturns(prices){
  const r=[];
  for(let i=1;i<prices.length;i++){ const p0=prices[i-1], p1=prices[i]; r.push(p0>0?p1/p0-1:0); }
  return r;
}
function statMean(a){ return a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0; }
function statStdev(a){ if(a.length<2) return 0; const m=statMean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1)); }
function downsideDev(a,mar=0){ if(!a.length) return 0; const d=a.map(x=>Math.min(0,x-mar)); return Math.sqrt(d.reduce((s,x)=>s+x*x,0)/a.length); }
function covariance(a,b){ const n=Math.min(a.length,b.length); if(n<2) return 0; const ma=statMean(a.slice(0,n)),mb=statMean(b.slice(0,n)); let c=0; for(let i=0;i<n;i++) c+=(a[i]-ma)*(b[i]-mb); return c/(n-1); }
// Annualised IRR (money-weighted return) of dated cash flows via bisection.
// flows: [{date:Date, amount}] — negative = invested, positive = received.
function xirr(flows){
  if(flows.length<2) return null;
  const t0=flows[0].date;
  const yr=d=>(d-t0)/(365.25*86400000);
  const npv=rate=>flows.reduce((s,f)=>s+f.amount/Math.pow(1+rate,yr(f.date)),0);
  let lo=-0.9999, hi=10, flo=npv(lo), fhi=npv(hi);
  if(!isFinite(flo)||!isFinite(fhi)||flo*fhi>0) return null;
  for(let k=0;k<200;k++){
    const mid=(lo+hi)/2, fm=npv(mid);
    if(Math.abs(fm)<1e-7) return mid;
    if(flo*fm<0){ hi=mid; } else { lo=mid; flo=fm; }
  }
  return (lo+hi)/2;
}
function computeMetrics(res, marketReturns){
  const prices=res.dailyRows.map(r=>r.price);
  const rets=dailyReturns(prices);
  const rf=0; // no risk-free input in this tool
  const exc=rets.map(r=>r-rf);
  const sd=statStdev(rets), dd=downsideDev(rets,rf);
  const sharpe = sd>0 ? statMean(exc)/sd*Math.sqrt(TRADING_DAYS) : null;
  const sortino= dd>0 ? statMean(exc)/dd*Math.sqrt(TRADING_DAYS) : null;
  const varMkt = Math.pow(statStdev(marketReturns),2);
  const beta   = varMkt>0 ? covariance(rets,marketReturns)/varMkt : null;
  const treynor= (beta!=null && Math.abs(beta)>1e-6) ? statMean(exc)*TRADING_DAYS/beta : null;
  const days=res.dailyRows;
  const years=(parseDate(days[days.length-1].date)-parseDate(days[0].date))/(365.25*86400000);
  const growth=rets.reduce((g,r)=>g*(1+r),1);
  const cagrTwr = (years>0 && growth>0) ? Math.pow(growth,1/years)-1 : null;
  const flows=res.investRows.map(r=>({date:parseDate(r.date), amount:-r.amountInvested}));
  if(flows.length && res.finalEquity>0) flows.push({date:parseDate(days[days.length-1].date), amount:res.finalEquity});
  const cagrMwr = xirr(flows);
  return {sharpe, sortino, treynor, cagrTwr, cagrMwr};
}
const fmtRatio  = v => (v==null||!isFinite(v)) ? '—' : v.toFixed(2);
// Always treat the input as a fraction (avoids fmt.pct's fraction-or-percent
// ambiguity, which would misread a CAGR/Treynor above 100%).
const fmtMetPct = v => (v==null||!isFinite(v)) ? '—' : (v*100).toFixed(2)+'%';

/* ─── DATE UTILS ─── */
function parseDate(s){ const [y,m,d]=s.split('-'); return new Date(+y,+m-1,+d); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function isoDate(d){ return d.toISOString().slice(0,10); }
function dayOfWeek(d){ return d.getDay(); } // 0=Sun
function getWeekdayInWeek(d, day){ // find given weekday (1=Mon..5=Fri) in the week of d
  const r=new Date(d);
  const dow=r.getDay()||7; // Mon=1..Sun=7
  const diff=(day)-(dow<=5?dow:5);
  r.setDate(r.getDate()+diff);
  return r;
}

/* ─── SIMULATED PRICE GENERATION (GBM) ─── */
function createSeededRng(seed){
  let state = seed >>> 0;
  if(state===0) state = 0x6d2b79f5;
  return function(){
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function deriveSeed(baseSeed, key=''){
  let h = (sanitizeSeed(baseSeed) >>> 0) || 0x811c9dc5;
  for(let i=0;i<key.length;i++){
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function generateGBMPrices(startDate, endDate, annualReturn, annualStd, startPrice=100, randomFn=Math.random){
  const dates=[];
  const prices=[];
  let d=new Date(startDate);
  const end=new Date(endDate);
  let price=startPrice;
  const dt=1/252;
  const mu=annualReturn/100;
  const sigma=annualStd/100;
  while(d<=end){
    const dow=d.getDay();
    if(dow!==0&&dow!==6){
      dates.push(isoDate(d));
      prices.push(price);
      // GBM step
      const z=(randomFn()*2-1)+(randomFn()*2-1)+(randomFn()*2-1); // approx normal
      price=price*Math.exp((mu-0.5*sigma*sigma)*dt+sigma*Math.sqrt(dt)*z);
    }
    d=addDays(d,1);
  }
  // Derive a plausible intraday O/H/L around each close so candlestick view has
  // real (simulated) candles. randomFn is consumed AFTER the close loop, so the
  // close path above is byte-identical to the close-only version and stays
  // deterministic for a given seed. Open = prior close; wicks scale with σ.
  const opens=[], highs=[], lows=[];
  const idv=sigma*Math.sqrt(dt); // ~one-day stdev fraction
  for(let i=0;i<prices.length;i++){
    const c=prices[i];
    const open=i===0?c:prices[i-1];
    const hi=Math.max(open,c)*(1+Math.abs(randomFn())*idv*0.8);
    const lo=Math.min(open,c)*(1-Math.abs(randomFn())*idv*0.8);
    opens.push(open); highs.push(hi); lows.push(Math.max(1e-6,lo));
  }
  return {dates, prices, opens, highs, lows};
}

/* ─── FETCH via Yahoo Finance chart endpoint ─── */
// The reliability engine (concurrent proxy race + retries + optional
// self-hosted proxy failsafe) lives in shared.js so the simulator and the
// portfolio tool share one hardened implementation. To remove the dependence
// on third-party CORS proxies entirely, deploy yf-proxy-worker.js and call
// SharedYF.setProxy('https://your-worker/?url=') once at startup.
async function fetchYahooFinance(ticker, startDate, endDate){
  if(!window.SharedYF) throw new Error('Market data engine not loaded (shared.js)');
  return window.SharedYF.fetchPrices(ticker, startDate, endDate);
}

/* ─── SECURITY MANAGEMENT ─── */
function getColor(idx){ return LINE_COLORS[idx % LINE_COLORS.length]; }
function getActiveSec(){ return securities.find(s=>s.id===activeSecurityId) || null; }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Wire a standardised number/money input (the shared currency-input design):
// live thousands-grouping while typing, re-format on blur, and push the parsed
// numeric value to `onVal` on every change. `opts` mirrors SharedFmt options
// ({maxDecimals, allowNegative}).
function wireMoneyField(el, opts, onVal){
  if(!el) return;
  const o = Object.assign({maxDecimals:0}, opts||{});
  el.addEventListener('input',()=>{ SharedFmt.liveFormat(el,o); onVal(SharedFmt.parseFormatted(el.value)); });
  el.addEventListener('blur',()=>{ SharedFmt.liveFormat(el,o); });
}

function addSecurity(cfg){
  const id = ++secIdCounter;
  const colorIdx = securities.length % LINE_COLORS.length;
  securities.forEach(s => { s.open = false; });
  const sec = {
    id, colorVar: getColor(colorIdx), colorName: COLOR_NAMES[colorIdx],
    colorHex: cfg.colorHex || LINE_COLOR_HEX[colorIdx],
    type: cfg.type, ticker: cfg.ticker||'', name: cfg.name||cfg.ticker||'Custom',
    amount: 500, yearlyIncrease: 0, style: 'monthly-date', dayOrDate: 1,
    returnPct: 8, stdPct: 15,
    momentumPct: 5, momentumEOM: true,
    techEOM: true,
    // Shared by the momentum + technical styles: invest once per 'monthly' or
    // 'weekly' window. Fixed-schedule date/weekly styles ignore it.
    period: 'monthly',
    priceData: null, loaded: false, open: true,
    ...cfg
  };
  // Technical-strategy parameters (merged so cfg can override individual fields).
  sec.tech = Object.assign({
    fastMaType:'ema', fastMaLen:50, slowMaType:'sma', slowMaLen:200,
    rsiPeriod:14, rsiOversold:35,
    bbPeriod:20, bbStd:2, bbTrigger:'below',
    macdFast:12, macdSlow:26, macdSignal:9, macdHistThreshold:0,
    adxPeriod:14, adxThreshold:25
  }, cfg.tech||{});
  // Ensure colorHex from cfg overrides the default set above
  if(cfg.colorHex) sec.colorHex = cfg.colorHex;
  securities.push(sec);
  activeSecurityId = sec.id;
  renderSecList();
  return sec;
}

function removeSecurity(id){
  const idx = securities.findIndex(s=>s.id===id);
  securities = securities.filter(s=>s.id!==id);
  if(activeSecurityId===id) activeSecurityId = securities.length ? securities[Math.max(0,Math.min(idx,securities.length-1))].id : null;
  renderSecList();
}

// Copy the active scenario (deep clone of its settings), insert after it, and select it.
function duplicateSecurity(id){
  const src = securities.find(s=>s.id===id); if(!src) return;
  const colorIdx = securities.length % LINE_COLORS.length;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = ++secIdCounter;
  copy.name = src.name + ' (copy)';
  copy.colorVar = getColor(colorIdx);
  copy.colorName = COLOR_NAMES[colorIdx];
  copy.colorHex = LINE_COLOR_HEX[colorIdx];
  copy.priceData = null; copy.loaded = false; copy.open = true;
  const idx = securities.findIndex(s=>s.id===id);
  securities.splice(idx+1, 0, copy);
  activeSecurityId = copy.id;
  renderSecList();
}

// Render both halves of the scenario UI (tab bar + active-scenario editor).
function renderSecList(){
  if(activeSecurityId==null && securities.length) activeSecurityId = securities[0].id;
  renderScenarioBar();
  renderScenarioConfig();
  updateTechToggleVisibility();
}

/* ─── SCENARIO BAR — one tab per scenario (click to edit, double-click to rename) ─── */
function renderScenarioBar(){
  const el=$('scenarioTabs'); if(!el) return;
  // Detach the + Add button before clearing so it can be re-appended right after
  // the last scenario tab (so it flows/wraps with the tabs, matching the portfolio
  // tool) — its click listener stays intact across re-renders.
  const addBtn=$('addScenarioBtn');
  el.innerHTML='';
  securities.forEach(sec=>{
    const tab=document.createElement('div');
    tab.className='sc-tab'+(sec.id===activeSecurityId?' active':'');
    tab.title=sec.name;

    const dot=document.createElement('input');
    dot.type='color'; dot.className='sc-tab-dot'; dot.value=sec.colorHex||LINE_COLOR_HEX[0]; dot.title='Pick colour';
    dot.addEventListener('click',e=>e.stopPropagation());
    dot.addEventListener('input',e=>{ sec.colorHex=e.target.value; renderScenarioBar(); if(simResults.length){ updatePriceChart(); updateEquityChart(); updateTables(); } });
    tab.appendChild(dot);

    const name=document.createElement('span');
    name.className='sc-tab-name'; name.textContent=sec.name||'Scenario';
    tab.appendChild(name);

    const badge=document.createElement('span');
    badge.className='sc-tab-badge'; badge.innerHTML=sec.type==='ticker'?SVG_TICKER:SVG_CUSTOM;
    tab.appendChild(badge);

    tab.addEventListener('click',()=>{ if(sec.id!==activeSecurityId){ activeSecurityId=sec.id; renderScenarioBar(); renderScenarioConfig(); } });
    tab.addEventListener('dblclick',()=>startRenameScenario(tab, sec));
    el.appendChild(tab);
  });
  // Keep the + Add button directly beside the last scenario so it flows with the tabs.
  if(addBtn) el.appendChild(addBtn);
}

function startRenameScenario(tab, sec){
  const nameSpan=tab.querySelector('.sc-tab-name'); if(!nameSpan) return;
  const input=document.createElement('input');
  input.type='text'; input.className='sc-tab-rename'; input.value=sec.name;
  input.addEventListener('click',e=>e.stopPropagation());
  input.addEventListener('dblclick',e=>e.stopPropagation());
  const commit=()=>{ sec.name=input.value.trim()||sec.name; renderScenarioBar(); renderScenarioConfig(); };
  input.addEventListener('blur',commit);
  input.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); commit(); } if(e.key==='Escape'){ renderScenarioBar(); } });
  nameSpan.replaceWith(input); input.focus(); input.select();
}

/* ─── CONFIGURE SCENARIO — editor bound to the active scenario ─── */
function renderScenarioConfig(){
  const wrap=$('scenarioConfig'); if(!wrap) return;
  const sec=getActiveSec();
  if(!sec){
    wrap.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:8px 0">No scenario yet — click + to add one.</div>';
    return;
  }
  const tks=loadedTickers();
  const sym=currentCurrencySymbol||'$';
  const fmtN=(v,neg)=>SharedFmt.formatThousands(v==null?0:v,{maxDecimals:2,allowNegative:!!neg});
  const tickerBody = tks.length
    ? `<select class="txt-input" id="cfgTickerSelect" style="width:100%;cursor:pointer">${tks.map(tk=>`<option value="${tk}" ${sec.ticker===tk?'selected':''}>${tk}</option>`).join('')}</select>`
    : `<div class="status-bar status-warn" style="display:block">No tickers loaded yet — add them in the 📥 Data tab first.</div>`;
  wrap.innerHTML=`
    <div class="add-sec-area" style="border-top:none;padding-top:0">
      <div class="add-sec-row" style="gap:6px;align-items:center">
        <input class="txt-input" id="cfgName" placeholder="Scenario name" value="${escapeHtml(sec.name)}" style="flex:1;min-width:0"/>
        <input type="color" id="cfgColor" value="${sec.colorHex||LINE_COLOR_HEX[0]}" title="Pick colour" style="width:34px;height:34px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--input-bg);padding:2px;flex-shrink:0"/>
      </div>

      <div class="section-label">Top-Ups</div>
      <div class="sec-row">
        <label>Amount per top-up <span class="tip-icon" data-tip="Base amount invested on each DCA purchase date (before any yearly increase).">?</span></label>
        <div class="currency-wrap">
          <span class="prefix" id="cfgAmountPrefix">${escapeHtml(sym)}</span>
          <input class="currency-input money-input" id="cfgAmount" type="text" inputmode="numeric" value="${fmtN(sec.amount)}"/>
        </div>
      </div>
      <div class="sec-row">
        <label>Yearly increase <span class="tip-icon" data-tip="Compounds the invested amount each full year. 0 keeps the amount constant; e.g. 10 raises it by 10% every year (year 2 = +10%, year 3 = +21%, …).">?</span></label>
        <div class="currency-wrap">
          <input class="currency-input money-input has-suffix" id="cfgYearlyInc" type="text" inputmode="numeric" value="${fmtN(sec.yearlyIncrease||0)}"/>
          <span class="suffix">%</span>
        </div>
      </div>

      <div class="section-label">Asset</div>
      <div class="radio-group">
        <label class="radio-opt${sec.type==='ticker'?' selected':''}" id="cfgTypeTicker">
          <input type="radio" name="cfgType" value="ticker" ${sec.type==='ticker'?'checked':''}/>
          <div class="radio-opt-text"><strong>Ticker</strong>Real price data — pick from your loaded tickers</div>
        </label>
        <label class="radio-opt${sec.type==='custom'?' selected':''}" id="cfgTypeCustom">
          <input type="radio" name="cfgType" value="custom" ${sec.type==='custom'?'checked':''}/>
          <div class="radio-opt-text"><strong>Custom</strong>Simulated asset (define return &amp; volatility)</div>
        </label>
      </div>
      ${sec.type==='ticker'
        ? `<div style="margin-top:8px">${tickerBody}</div>`
        : `<div class="sec-row" style="margin-top:8px">
             <label>Return (% p.a.) <span class="tip-icon" data-tip="Expected annual return used to generate a simulated price path via Geometric Brownian Motion.">?</span></label>
             <div class="currency-wrap">
               <input class="currency-input money-input has-suffix" id="cfgReturn" type="text" inputmode="numeric" value="${fmtN(sec.returnPct,true)}"/>
               <span class="suffix">%</span>
             </div>
           </div>
           <div class="sec-row">
             <label>Standard deviation (%) <span class="tip-icon" data-tip="Annual volatility (standard deviation). Higher values produce more volatile simulated paths.">?</span></label>
             <div class="currency-wrap">
               <input class="currency-input money-input has-suffix" id="cfgStd" type="text" inputmode="numeric" value="${fmtN(sec.stdPct)}"/>
               <span class="suffix">%</span>
             </div>
           </div>`}
      <div style="padding:6px 0 0">
        <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">Investment Style</div>
        <div id="styleBlock${sec.id}">${styleBlockInner(sec)}</div>
      </div>
    </div>`;

  $('cfgName').addEventListener('input',e=>{ sec.name=e.target.value; renderScenarioBar(); });
  $('cfgColor').addEventListener('input',e=>{ sec.colorHex=e.target.value; renderScenarioBar(); if(simResults.length){ updatePriceChart(); updateEquityChart(); updateTables(); } });
  document.querySelectorAll('input[name="cfgType"]').forEach(r=>{
    r.addEventListener('change',()=>{
      sec.type=r.value;
      if(sec.type==='ticker'){ const t=loadedTickers(); if(t.length && !t.includes(sec.ticker)) sec.ticker=t[0]; }
      renderScenarioBar();
      renderScenarioConfig();
      updateTechToggleVisibility();
      scheduleRun();
    });
  });
  const tsel=$('cfgTickerSelect'); if(tsel) tsel.addEventListener('change',e=>{ sec.ticker=e.target.value; scheduleRun(); });
  const ret=$('cfgReturn'); if(ret) wireMoneyField(ret,{maxDecimals:2,allowNegative:true},v=>{ sec.returnPct=v; scheduleRun(); });
  const std=$('cfgStd'); if(std) wireMoneyField(std,{maxDecimals:2},v=>{ sec.stdPct=Math.max(0,v); scheduleRun(); });
  wireMoneyField($('cfgAmount'),{maxDecimals:2},v=>{ sec.amount=Math.max(0,v); scheduleRun(); });
  wireMoneyField($('cfgYearlyInc'),{maxDecimals:2},v=>{ sec.yearlyIncrease=Math.max(0,v); scheduleRun(); });
  wireStyleBlock(sec);
}

function renderStyleOpt(sec,s){
  return `<label class="radio-opt${sec.style===s?' selected':''}" id="secStyleOpt${sec.id}_${s.replace(/-/g,'_')}">
    <input type="radio" name="secStyle${sec.id}" value="${s}" ${sec.style===s?'checked':''}/>
    <div class="radio-opt-text"><strong>${styleLabel(s)}</strong>${styleDesc(s)}</div>
  </label>`;
}

function renderDaySelectorInner(sec){
  if(sec.style==='weekly-day')
    return `<select class="txt-input" id="secDay${sec.id}" style="max-width:170px">${WEEKDAY_OPTIONS.map((d,i)=>`<option value="${i+1}" ${Math.min(7,Math.max(1,sec.dayOrDate))===i+1?'selected':''}>${d}</option>`).join('')}</select>`;
  if(sec.style==='monthly-date')
    return `<input class="num-input" id="secDay${sec.id}" type="number" min="1" max="31" step="1" value="${Math.min(31,Math.max(1,sec.dayOrDate||1))}" style="max-width:80px"/>`;
  return '';
}

function wireDayInput(sec){
  const el=$(`secDay${sec.id}`); if(!el) return;
  ['input','change'].forEach(ev=>el.addEventListener(ev,e=>{ sec.dayOrDate=parseInt(e.target.value)||1; scheduleRun(); }));
}

function renderDaySelector(sec){ return renderDaySelectorInner(sec); }

function styleLabel(s){
  return {'monthly-date':'Monthly (Fixed Date)','monthly-top':'Monthly (Top)','monthly-bottom':'Monthly (Bottom)',
          'weekly-day':'Weekly (Fixed Day)','weekly-top':'Weekly (Top)','weekly-bottom':'Weekly (Bottom)',
          'momentum-peak':'Buy the Peak','momentum-dip':'Buy the Dip',
          'tech-ma-cross':'MA Crossover','tech-rsi':'RSI Oversold Buy','tech-bollinger':'Bollinger Band Dip',
          'tech-macd-cross':'MACD Bullish Cross','tech-macd-hist':'MACD Histogram Recovery','tech-adx':'ADX Trend Filter'}[s]||s;
}
function styleDesc(s){
  return {'monthly-date':'Buy on a specific day each month.',
          'monthly-top':'Buy on the highest price day of the month.',
          'monthly-bottom':'Buy on the lowest price day of the month.',
          'weekly-day':'Buy on a chosen weekday each week.',
          'weekly-top':'Buy on the peak price day of the week.',
          'weekly-bottom':'Buy on the lowest price day of the week.',
          'momentum-peak':'Invest once price rises by the set % from the period open.',
          'momentum-dip':'Invest once price falls by the set % from the period open.',
          'tech-ma-cross':'Buy on a golden cross of two moving averages.',
          'tech-rsi':'Buy when RSI drops into oversold territory.',
          'tech-bollinger':'Buy when price dips to the lower Bollinger Band.',
          'tech-macd-cross':'Buy when MACD crosses above its signal line.',
          'tech-macd-hist':'Buy when the MACD histogram turns positive.',
          'tech-adx':'Buy only when the trend is strong (high ADX).'}[s]||'';
}
function showDayRow(s){ return s==='monthly-date'||s==='weekly-day'; }

/* ─── INVESTMENT-STYLE PICKER (category-based, progressive disclosure) ─── */
// To keep the panel uncluttered, styles are grouped into categories. Only the
// active category's options — plus the parameters for the currently selected
// style — are shown at any time.
// Scenario-type badges: a dollar sign for ticker-backed scenarios, the "fx"
// formula glyph for custom (hand-entered return) scenarios.
const SVG_TICKER='<svg class="tico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2v17.6"/><path d="M16 7.4c0-2-1.8-3.2-4-3.2S8 5.4 8 7.5s1.8 3 4 3.4 4 1.4 4 3.5-1.8 3.4-4 3.4-4-1.2-4-3.2"/></svg>';
const SVG_CUSTOM='<svg class="tico" viewBox="0 0 24 24" fill="none"><text x="12" y="17.6" font-size="15.5" font-style="italic" font-weight="700" stroke="none" fill="currentColor" text-anchor="middle" font-family="Georgia,Cambria,&quot;Times New Roman&quot;,serif">fx</text></svg>';
const SVG_DATE='<svg class="tico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 3v3.5"/><path d="M16 3v3.5"/><polyline points="6.5 17.5 9.5 14 12 15.5 16.5 12"/></svg>';
const SVG_MOMENTUM='<svg class="tico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17a8 8 0 0 1 16 0"/><path d="M12 17 16.5 11"/><circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none"/></svg>';
const SVG_TECH='<svg class="tico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 15 7 9 11 14 15 8 21 12"/><path d="M3 12h18" stroke-dasharray="2.2 2.4"/></svg>';
const SVG_FORWARD='<svg class="tico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 7 11 11 13.5"/><polyline points="11 13.5 15 8 21 11" stroke-dasharray="0.1 3.4"/></svg>';
const STYLE_CATEGORIES=[['date',SVG_DATE+' Date'],['momentum',SVG_MOMENTUM+' Momentum'],['tech',SVG_TECH+' Technical'],['forward',SVG_FORWARD+' Forward']];
function styleCategory(s){
  if(DATE_BASED_STYLES.includes(s)) return 'date';
  if(MOMENTUM_STYLES.includes(s)) return 'momentum';
  if(TECH_STYLES.includes(s)) return 'tech';
  if(FORWARD_STYLES.includes(s)) return 'forward';
  return 'date';
}
function stylesForCat(c){
  return {date:DATE_BASED_STYLES,momentum:MOMENTUM_STYLES,tech:TECH_STYLES,forward:FORWARD_STYLES}[c]||DATE_BASED_STYLES;
}

function styleBlockInner(sec){
  const active = sec.catOpen || styleCategory(sec.style);
  const pills = STYLE_CATEGORIES.map(([k,label])=>
    `<button type="button" class="cat-pill${k===active?' active':''}" data-cat="${k}">${label}</button>`).join('');
  const opts = stylesForCat(active).map(s=>renderStyleOpt(sec,s)).join('');
  const warn = active==='forward'
    ? `<div class="param-note warn-note">⚠️ For demonstration only — these use prices within the period to pick the buy date and require future knowledge that cannot be replicated in real life.</div>`
    : '';
  // Show parameters only when the selected style belongs to the open category.
  const params = (styleCategory(sec.style)===active) ? renderStyleParams(sec) : '';
  return `
    <div class="cat-pills">${pills}</div>
    ${warn}
    <div class="radio-group" style="margin-top:8px">${opts}</div>
    <div class="style-params" id="styleParams${sec.id}">${params}</div>`;
}

// Monthly / Weekly segmented control — shared by the momentum + technical
// styles so each can invest once per chosen window (the date/forward styles
// carry their own cadence and don't show it).
function periodToggleRow(sec, id){
  const p = (sec.period==='weekly') ? 'weekly' : 'monthly';
  const word = p==='weekly' ? 'week' : 'month';
  return `<div class="param-row"><label>Frequency <span class="tip-icon" data-tip="Invest once per ${word}: on the first day the trigger is met within the ${word}; otherwise skip that ${word} (or deposit on its last trading day if 'Invest at End of ${word.charAt(0).toUpperCase()+word.slice(1)}' is ticked below).">?</span></label>
      <div class="seg" id="secPeriodSeg${id}" role="group" aria-label="Investment frequency">
        <button type="button" class="seg-btn${p==='monthly'?' active':''}" data-period="monthly">Monthly</button>
        <button type="button" class="seg-btn${p==='weekly'?' active':''}" data-period="weekly">Weekly</button>
      </div></div>`;
}

function renderStyleParams(sec){
  const s=sec.style;
  const freqRow = (MOMENTUM_STYLES.includes(s)||TECH_STYLES.includes(s)) ? periodToggleRow(sec, sec.id) : '';
  return freqRow + styleParamsBody(sec);
}

function styleParamsBody(sec){
  const s=sec.style, t=sec.tech||{}, id=sec.id;
  const periodWord = (sec.period==='weekly') ? 'Week' : 'Month';
  const eomChecked = MOMENTUM_STYLES.includes(s) ? sec.momentumEOM : sec.techEOM;
  const eomRow = `<label class="tech-eom"><input type="checkbox" id="secTechEOM${id}" ${eomChecked?'checked':''}/> Invest at End of ${periodWord} if target not reached</label>`;
  const maTypeSel=(elId,val)=>`<select class="num-input" id="${elId}" style="max-width:84px">
      <option value="sma" ${val==='sma'?'selected':''}>SMA</option>
      <option value="ema" ${val==='ema'?'selected':''}>EMA</option></select>`;
  if(s==='monthly-date')
    return `<div class="param-row"><label>Day of month</label><input class="num-input" id="secDay${id}" type="number" min="1" max="31" step="1" value="${Math.min(31,Math.max(1,sec.dayOrDate||1))}"/></div>`;
  if(s==='weekly-day')
    return `<div class="param-row"><label>Day of week</label><select class="txt-input" id="secDay${id}" style="max-width:160px">${WEEKDAY_OPTIONS.map((d,i)=>`<option value="${i+1}" ${Math.min(7,Math.max(1,sec.dayOrDate))===i+1?'selected':''}>${d}</option>`).join('')}</select></div>`;
  if(MOMENTUM_STYLES.includes(s))
    return `<div style="padding:4px 0 2px">
        <div class="slider-head" style="margin-bottom:4px">
          <span style="font-size:.8rem;color:var(--muted);font-weight:700">Threshold</span>
          <span id="secMomPctVal${id}" class="slider-value">${(+sec.momentumPct).toFixed(1)}%</span>
        </div>
        <input type="range" id="secMomPct${id}" min="0.1" max="50" step="0.1" value="${sec.momentumPct}" style="width:100%;accent-color:var(--accent);cursor:pointer"/>
      </div>${eomRow}`;
  if(s==='tech-ma-cross')
    return `<div class="param-row"><label>Fast MA</label><div class="param-grp">${maTypeSel(`secMaFastType${id}`,t.fastMaType)}<input class="num-input" id="secMaFastLen${id}" type="number" min="1" max="400" step="1" value="${t.fastMaLen}"/></div></div>
      <div class="param-row"><label>Slow MA</label><div class="param-grp">${maTypeSel(`secMaSlowType${id}`,t.slowMaType)}<input class="num-input" id="secMaSlowLen${id}" type="number" min="1" max="400" step="1" value="${t.slowMaLen}"/></div></div>
      <div class="param-note">Buys on a golden cross — the Fast MA crossing above the Slow MA.</div>${eomRow}`;
  if(s==='tech-rsi')
    return `<div class="param-row"><label>RSI period</label><input class="num-input" id="secRsiPeriod${id}" type="number" min="2" max="100" step="1" value="${t.rsiPeriod}"/></div>
      <div class="param-row"><label>Oversold &lt;</label><input class="num-input" id="secRsiOversold${id}" type="number" min="1" max="99" step="1" value="${t.rsiOversold}"/></div>
      <div class="param-note">Buys when RSI falls below the oversold threshold.</div>${eomRow}`;
  if(s==='tech-bollinger')
    return `<div class="param-row"><label>MA period</label><input class="num-input" id="secBbPeriod${id}" type="number" min="2" max="200" step="1" value="${t.bbPeriod}"/></div>
      <div class="param-row"><label>Std dev</label><input class="num-input" id="secBbStd${id}" type="number" min="0.5" max="5" step="0.1" value="${t.bbStd}"/></div>
      <div class="param-row"><label>Trigger</label><select class="txt-input" id="secBbTrigger${id}" style="max-width:220px"><option value="below" ${t.bbTrigger==='below'?'selected':''}>Close below lower band</option><option value="reclaim" ${t.bbTrigger==='reclaim'?'selected':''}>Reclaim above lower band</option></select></div>
      <div class="param-note">Bollinger Band = MA ± N standard deviations.</div>${eomRow}`;
  if(s==='tech-macd-cross')
    return `<div class="param-row"><label>Fast EMA</label><input class="num-input" id="secMacdFast${id}" type="number" min="1" max="100" step="1" value="${t.macdFast}"/></div>
      <div class="param-row"><label>Slow EMA</label><input class="num-input" id="secMacdSlow${id}" type="number" min="1" max="200" step="1" value="${t.macdSlow}"/></div>
      <div class="param-row"><label>Signal EMA</label><input class="num-input" id="secMacdSignal${id}" type="number" min="1" max="100" step="1" value="${t.macdSignal}"/></div>
      <div class="param-note">Buys when the MACD line crosses above the signal line.</div>${eomRow}`;
  if(s==='tech-macd-hist')
    return `<div class="param-row"><label>Fast EMA</label><input class="num-input" id="secMacdFast${id}" type="number" min="1" max="100" step="1" value="${t.macdFast}"/></div>
      <div class="param-row"><label>Slow EMA</label><input class="num-input" id="secMacdSlow${id}" type="number" min="1" max="200" step="1" value="${t.macdSlow}"/></div>
      <div class="param-row"><label>Signal EMA</label><input class="num-input" id="secMacdSignal${id}" type="number" min="1" max="100" step="1" value="${t.macdSignal}"/></div>
      <div class="param-row"><label>Hist &gt;</label><input class="num-input" id="secMacdHist${id}" type="number" step="0.1" value="${t.macdHistThreshold}"/></div>
      <div class="param-note">Buys when the histogram turns positive after being negative.</div>${eomRow}`;
  if(s==='tech-adx')
    return `<div class="param-row"><label>ADX period</label><input class="num-input" id="secAdxPeriod${id}" type="number" min="2" max="100" step="1" value="${t.adxPeriod}"/></div>
      <div class="param-row"><label>Trend &gt;</label><input class="num-input" id="secAdxThreshold${id}" type="number" min="1" max="100" step="1" value="${t.adxThreshold}"/></div>
      <div class="param-note">Buys only when ADX shows a strong trend (close-based ADX).</div>${eomRow}`;
  return ''; // forward-looking styles have no parameters
}

function refreshStyleBlock(sec){
  const c=$(`styleBlock${sec.id}`); if(!c) return;
  c.innerHTML=styleBlockInner(sec);
  wireStyleBlock(sec);
}

function wireStyleBlock(sec){
  const c=$(`styleBlock${sec.id}`); if(!c) return;
  // Category pills — switch which options are visible without changing selection.
  c.querySelectorAll('.cat-pill').forEach(p=>{
    p.addEventListener('click',()=>{ sec.catOpen=p.dataset.cat; refreshStyleBlock(sec); });
  });
  // Style radios
  c.querySelectorAll(`input[name="secStyle${sec.id}"]`).forEach(r=>{
    r.addEventListener('change',()=>{
      sec.style=r.value;
      sec.catOpen=styleCategory(sec.style);
      if(showDayRow(sec.style)) sec.dayOrDate=1;
      refreshStyleBlock(sec);
      updateTechToggleVisibility();
      scheduleRun();
    });
  });
  // Date-based day selector
  wireDayInput(sec);
  // Momentum threshold slider
  const momPctEl=$(`secMomPct${sec.id}`), momPctValEl=$(`secMomPctVal${sec.id}`);
  if(momPctEl){
    momPctEl.addEventListener('input',e=>{ sec.momentumPct=parseFloat(e.target.value)||5; if(momPctValEl) momPctValEl.textContent=(+sec.momentumPct).toFixed(1)+'%'; scheduleRun(); });
    makeSliderEditable(momPctValEl,momPctEl);
  }
  // Monthly / Weekly frequency toggle (momentum + technical). Re-render the
  // block on change so the EOM label and helper note pick up the new window.
  const periodSeg=$(`secPeriodSeg${sec.id}`);
  if(periodSeg) periodSeg.querySelectorAll('.seg-btn').forEach(b=>{
    b.addEventListener('click',()=>{ sec.period=b.dataset.period==='weekly'?'weekly':'monthly'; refreshStyleBlock(sec); scheduleRun(); });
  });
  // Shared "invest at end of month/week" toggle (momentum + technical)
  const eomEl=$(`secTechEOM${sec.id}`);
  if(eomEl) eomEl.addEventListener('change',e=>{ sec.techEOM=e.target.checked; sec.momentumEOM=e.target.checked; scheduleRun(); });
  // Technical-strategy parameters
  const bind=(elId,fn)=>{ const el=$(elId); if(el)['input','change'].forEach(ev=>el.addEventListener(ev,e=>{ fn(e.target.value); scheduleRun(); })); };
  const ti=v=>{ const n=parseInt(v); return isNaN(n)?null:n; };
  const tf=v=>{ const n=parseFloat(v); return isNaN(n)?null:n; };
  bind(`secMaFastType${sec.id}`,v=>sec.tech.fastMaType=v);
  bind(`secMaFastLen${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.fastMaLen=n; });
  bind(`secMaSlowType${sec.id}`,v=>sec.tech.slowMaType=v);
  bind(`secMaSlowLen${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.slowMaLen=n; });
  bind(`secRsiPeriod${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.rsiPeriod=n; });
  bind(`secRsiOversold${sec.id}`,v=>{ const n=tf(v); if(n!=null) sec.tech.rsiOversold=n; });
  bind(`secBbPeriod${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.bbPeriod=n; });
  bind(`secBbStd${sec.id}`,v=>{ const n=tf(v); if(n!=null) sec.tech.bbStd=n; });
  bind(`secBbTrigger${sec.id}`,v=>sec.tech.bbTrigger=v);
  bind(`secMacdFast${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.macdFast=n; });
  bind(`secMacdSlow${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.macdSlow=n; });
  bind(`secMacdSignal${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.macdSignal=n; });
  bind(`secMacdHist${sec.id}`,v=>{ const n=tf(v); if(n!=null) sec.tech.macdHistThreshold=n; });
  bind(`secAdxPeriod${sec.id}`,v=>{ const n=ti(v); if(n) sec.tech.adxPeriod=n; });
  bind(`secAdxThreshold${sec.id}`,v=>{ const n=tf(v); if(n!=null) sec.tech.adxThreshold=n; });
}

/* ─── FETCH TICKER DATA ─── */

/* ─── PRICE CACHE HELPERS ─── */
// Ensures priceCache[ticker] covers [requestedStart, requestedEnd].
// Fetches only when the cache is absent or the range must be expanded.
// Returns true on success, throws on failure.
async function ensureTickerCached(ticker, requestedStart, requestedEnd){
  const tk = String(ticker||'').trim().toUpperCase();
  if(!tk) throw new Error('Invalid ticker');
  const entry = priceCache[tk];
  if(entry && entry.coverageStart <= requestedStart && entry.coverageEnd >= requestedEnd){
    return; // Cache already covers the full requested range — no fetch needed
  }
  if(tickerFetchInFlight[tk]){
    await tickerFetchInFlight[tk];
    return;
  }
  tickerFetchInFlight[tk] = (async()=>{
    const latestEntry = priceCache[tk];
    if(latestEntry && latestEntry.coverageStart <= requestedStart && latestEntry.coverageEnd >= requestedEnd){
      return;
    }
    // Fetch ONLY the segment(s) we don't already hold, then merge — never
    // re-download the whole history just to widen the range.
    const segments = [];
    if(!latestEntry){
      segments.push([requestedStart, requestedEnd]);
    } else {
      if(requestedStart < latestEntry.coverageStart) segments.push([requestedStart, latestEntry.coverageStart]);
      if(requestedEnd   > latestEntry.coverageEnd)   segments.push([latestEntry.coverageEnd, requestedEnd]);
    }
    let got = false;
    for(const [segStart, segEnd] of segments){
      const data = await fetchYahooFinance(tk, segStart, segEnd);
      if(data && data.dates && data.dates.length){
        storeBatchResult(tk, data, segStart, segEnd);
        got = true;
      }
    }
    // Make sure coverage reflects what the caller asked for even if a segment
    // returned no rows (e.g. a market holiday tail) — past prices are immutable.
    const e = priceCache[tk];
    if(e){
      e.coverageStart = minIso(e.coverageStart, requestedStart);
      e.coverageEnd   = maxIso(e.coverageEnd, requestedEnd);
    } else if(!got){
      throw new Error('No price data in range');
    }
  })();
  try{
    await tickerFetchInFlight[tk];
  } finally {
    delete tickerFetchInFlight[tk];
  }
}

// Returns a {dates, prices, [opens, highs, lows]} slice from the cache filtered
// to [startDate, endDate]. OHLC arrays are included only when the cache holds
// them (i.e. fetched from a Worker that returns OHLC); otherwise close-only.
function getCachedPriceSlice(ticker, startDate, endDate){
  const tk = String(ticker||'').trim().toUpperCase();
  const entry = priceCache[tk];
  if(!entry) return null;
  const si = entry.dates.findIndex(d => d >= startDate);
  const ei = entry.dates.findLastIndex(d => d <= endDate);
  if(si < 0 || ei < 0 || si > ei) return null;
  const out = { dates: entry.dates.slice(si, ei + 1), prices: entry.prices.slice(si, ei + 1) };
  if(entry.opens && entry.highs && entry.lows){
    out.opens = entry.opens.slice(si, ei + 1);
    out.highs = entry.highs.slice(si, ei + 1);
    out.lows  = entry.lows.slice(si, ei + 1);
  }
  return out;
}

function isTickerRangeCovered(ticker, startDate, endDate){
  const tk = String(ticker||'').trim().toUpperCase();
  const entry = priceCache[tk];
  return !!(entry && entry.coverageStart <= startDate && entry.coverageEnd >= endDate);
}

/* ─── PERSISTENT CACHE ─── */
// Price history is immutable for past dates, so we persist the cache to
// localStorage. On a new day coverageEnd (yesterday) no longer reaches "today",
// so the pool loader naturally refetches to refresh the tail — at most one
// request — while same-day reloads cost ZERO requests.
function persistPriceCache(){
  try { localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({savedAt: Date.now(), cache: priceCache})); }
  catch(_){ /* quota / private mode — caching is best-effort */ }
}
function loadPersistedCache(){
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && parsed.cache && typeof parsed.cache === 'object') priceCache = parsed.cache;
  } catch(_){ /* ignore corrupt cache */ }
}

/* ─── TICKER POOL (load everything up front, in one request) ─── */
// Returns the sorted list of tickers currently held in the cache.
function loadedTickers(){ return Object.keys(priceCache).sort(); }

// Store one batched result into the cache. `r` is the Worker's per-ticker object.
// If the ticker is already (partially) cached, the freshly-fetched dates are
// MERGED into the existing history rather than replacing it, so an incremental
// tail/front fetch never discards data we already hold.
function storeBatchResult(tk, r, fetchStart, fetchEnd){
  if(!(r && !r.error && r.dates && r.dates.length)) return false;
  const prev = priceCache[tk];
  let dates = r.dates, prices = r.prices;
  // OHLC is carried through only when the Worker returns it (newer deployments).
  let opens = r.opens, highs = r.highs, lows = r.lows;
  if(prev && prev.dates && prev.dates.length && window.SharedYF && SharedYF.mergeSeries){
    const m = SharedYF.mergeSeries(
      {dates:prev.dates, prices:prev.prices, opens:prev.opens, highs:prev.highs, lows:prev.lows},
      {dates:r.dates,    prices:r.prices,    opens:r.opens,    highs:r.highs,    lows:r.lows});
    dates = m.dates; prices = m.prices; opens = m.opens; highs = m.highs; lows = m.lows;
  }
  priceCache[tk] = {
    dates, prices,
    ...(opens && highs && lows ? {opens, highs, lows} : {}),
    cachedStart: dates[0], cachedEnd: dates[dates.length-1],
    coverageStart: prev ? minIso(prev.coverageStart, fetchStart) : fetchStart,
    coverageEnd: prev ? maxIso(prev.coverageEnd, fetchEnd) : fetchEnd,
    source: r.source, kind: r.kind
  };
  return true;
}
function minIso(a, b){ return (a && a < b) ? a : b; }
function maxIso(a, b){ return (a && a > b) ? a : b; }

// Once anything is cached, the load action is additive — relabel the button so
// users know subsequent loads add to (not replace) the pool.
function loadBtnLabel(){ return loadedTickers().length ? '⤓ Load additional tickers' : '⤓ Load tickers'; }
function updateLoadBtnLabel(){ const b=$('loadTickersBtn'); if(b && !b.disabled) b.innerHTML=loadBtnLabel(); }

function renderPoolChips(){
  const box = $('poolChips');
  if(!box) return;
  const tks = loadedTickers();
  const wrap = $('poolChipsWrap');
  if(!tks.length){ box.innerHTML=''; if(wrap) wrap.style.display='none'; updateLoadBtnLabel(); return; }
  if(wrap) wrap.style.display='';
  box.innerHTML = tks.map(tk=>{
    const e = priceCache[tk];
    const warn = (e && e.kind==='stock' && e.source==='stooq');
    const range = (e && e.dates && e.dates.length) ? e.dates[0]+' to '+e.dates[e.dates.length-1] : '';
    const title = warn ? 'Loaded from Stooq (unadjusted for splits/dividends)'+(range?' · '+range:'') : range;
    return `<span class="pool-chip${warn?' pool-chip-warn':''}" title="${title}">${tk}${warn?' ⚠️':''}<button class="pool-chip-del" type="button" data-tk="${tk}" title="Remove ${tk}" aria-label="Remove ${tk}">×</button></span>`;
  }).join('');
  box.querySelectorAll('.pool-chip-del').forEach(b=>b.addEventListener('click', ()=>removeFromPool(b.dataset.tk)));
  updateLoadBtnLabel();
}

// Remove a single ticker from the cached pool and reflect it everywhere.
function removeFromPool(tk){
  tk = String(tk||'').trim().toUpperCase();
  if(!tk || !priceCache[tk]) return;
  delete priceCache[tk];
  persistPriceCache();
  renderPoolChips();
  refreshTickerSelect();
  if(loadedTickers().length) showStatus($('poolStatus'), tk+' removed.','ok');
  else { hideStatus($('poolStatus')); }
}

// Drop the entire cached pool (the data the app shows on first open lives here).
function clearPool(){
  if(!loadedTickers().length) return;
  priceCache = {};
  persistPriceCache();
  renderPoolChips();
  refreshTickerSelect();
  hideStatus($('poolStatus'));
  const inp=$('tickerPoolInput'); if(inp) inp.focus();
}

// Reflect a freshly-loaded pool in the active scenario's ticker dropdown.
function refreshTickerSelect(){
  if($('scenarioConfig')) renderScenarioConfig();
}

// Loading is additive and individual tickers are removed via the chip ✕, so the
// input is never locked — it always stays open for adding the next batch.
function setPoolLocked(_locked){
  const inp = $('tickerPoolInput'), editBtn = $('editTickersBtn');
  if(inp) inp.disabled = false;
  if(editBtn) editBtn.style.display = 'none';
  updateBtnRow();
}

// Parse the textarea and fetch every NOT-yet-cached ticker, downloading only the
// data we don't already hold:
//   • brand-new (or front-gapped) tickers → full [POOL_FETCH_START … today]
//   • cached tickers missing only recent days → just [lastCovered … today]
// Each group is sent as a single batched Worker request (one daily request each).
async function loadTickerPool(){
  const inp = $('tickerPoolInput');
  const list = [...new Set((inp.value||'').split(/[\s,;]+/).map(s=>s.trim().toUpperCase()).filter(Boolean))];
  if(!list.length){ showStatus($('poolStatus'),'Enter at least one ticker.','error'); return; }
  if(!window.SharedYF){ showStatus($('poolStatus'),'Market data engine not loaded (shared.js).','error'); return; }

  const fetchEnd = isoDate(new Date());
  // Partition the requested tickers by how much data is actually missing.
  const fullNeed = [], tailNeed = [];
  let tailStart = fetchEnd;
  for(const t of list){
    if(isTickerRangeCovered(t, POOL_FETCH_START, fetchEnd)) continue; // already complete
    const e = priceCache[t];
    if(e && e.coverageStart <= POOL_FETCH_START && e.coverageEnd < fetchEnd){
      tailNeed.push(t);                                   // only the recent tail is missing
      if(e.coverageEnd < tailStart) tailStart = e.coverageEnd;
    } else {
      fullNeed.push(t);                                   // no cache (or a front gap) → full history
    }
  }
  const need = fullNeed.length + tailNeed.length;
  if(!need){
    showStatus($('poolStatus'),'All requested tickers are already cached.','ok');
    if(inp) inp.value=''; renderPoolChips(); refreshTickerSelect(); updateRateInfo();
    return;
  }

  // Soft daily cap — refuse early with a clear message instead of burning a wasted call.
  const reqsNeeded = (fullNeed.length?1:0) + (tailNeed.length?1:0);
  const remaining = SharedYF.getDailyRemaining();
  if(remaining <= 0){
    showStatus($('poolStatus'),'Daily limit reached — you\'ve used all '+SharedYF.getDailyLimit()+' data requests for today. They reset tomorrow; cached tickers still work.','error');
    updateRateInfo();
    return;
  }

  const loadBtn = $('loadTickersBtn');
  loadBtn.disabled = true; loadBtn.innerHTML = '<span class="spinner"></span>Loading…';
  try {
    showStatus($('poolStatus'),'Fetching '+need+' ticker(s)'+(reqsNeeded>1?' in '+reqsNeeded+' requests':' in one request')+'…','loading');
    const failed = [];
    let ok = 0;
    const absorb = (group, start, map)=>{
      for(const t of group){
        if(storeBatchResult(t, map[t], start, fetchEnd)) ok++;
        else failed.push(t + (map[t] && map[t].error ? ' ('+map[t].error+')' : ''));
      }
    };
    // Tail extensions first — they're cheap and refresh existing data.
    if(tailNeed.length){
      const map = await SharedYF.fetchPricesBatch(tailNeed, tailStart, fetchEnd);
      absorb(tailNeed, tailStart, map);
    }
    if(fullNeed.length){
      const map = await SharedYF.fetchPricesBatch(fullNeed, POOL_FETCH_START, fetchEnd);
      absorb(fullNeed, POOL_FETCH_START, map);
    }
    persistPriceCache();
    if(failed.length && ok) showStatus($('poolStatus'), ok+' loaded · could not load: '+failed.join(', '),'warn');
    else if(failed.length) showStatus($('poolStatus'),'Could not load: '+failed.join(', '),'error');
    else showStatus($('poolStatus'), ok+' ticker(s) loaded and cached.','ok');
    if(ok && !failed.length && inp) inp.value='';
    renderPoolChips();
    refreshTickerSelect();
  } catch(e){
    showStatus($('poolStatus'),'Load failed: '+e.message,'error');
  } finally {
    loadBtn.disabled = false; loadBtn.innerHTML = loadBtnLabel();
    updateRateInfo();
  }
}

// Reflect the device's remaining daily data requests in the Data tab.
function updateRateInfo(){
  const el = $('rateInfo'); if(!el || !window.SharedYF) return;
  const left = SharedYF.getDailyRemaining(), lim = SharedYF.getDailyLimit();
  el.textContent = left + ' of ' + lim + ' daily data requests remaining on this device.';
  el.classList.toggle('rate-info-low', left <= 1);
}

/* ─── FETCH TICKER DATA (for manual "Add Security" flow) ─── */
async function loadTickerData(sec, startDate, endDate){
  const statusEl = $(`secLoadStatus${sec.id}`);
  const covered = isTickerRangeCovered(sec.ticker, startDate, endDate);
  if(covered){
    showStatus($('fetchStatus'), 'Using cached '+sec.ticker+'...','loading');
  } else {
    showStatus($('fetchStatus'), 'Fetching '+sec.ticker+'...','loading');
  }
  try {
    showStatus($('fetchStatus'), 'Fetching '+sec.ticker+'...','loading');
    await ensureTickerCached(sec.ticker, startDate, endDate);
    sec.loaded = true;
    const entry = priceCache[String(sec.ticker).trim().toUpperCase()];
    if(statusEl){ statusEl.className='status-bar status-ok'; statusEl.textContent='✓ Loaded'; }
    if(entry.kind==='stock' && entry.source==='stooq'){
      showStatus($('fetchStatus'), '⚠️ '+sec.ticker+' loaded from Stooq (Yahoo Finance was unavailable): '+entry.dates.length+' trading days. Stooq stock prices are <strong>not</strong> adjusted for splits/dividends, so returns across those events may differ slightly.','warn');
    } else {
      showStatus($('fetchStatus'), sec.ticker+' cached: '+entry.dates.length+' trading days','ok');
    }
    return true;
  } catch(e){
    sec.loaded = false;
    if(statusEl){ statusEl.className='status-bar status-error'; statusEl.textContent='✗ Failed'; }
    showStatus($('fetchStatus'),'Failed to load '+sec.ticker+': '+e.message,'error');
    return false;
  }
}

/* ─── SCENARIO BAR ACTIONS (add / copy / delete) ─── */
// A new scenario defaults to a ticker (the loaded pool) when available, else a
// custom simulated asset, matching the "ticker first" preference in the editor.
$('addScenarioBtn').addEventListener('click', ()=>{
  const tks = loadedTickers();
  const n = securities.length + 1;
  if(tks.length) addSecurity({type:'ticker', ticker:tks[0], name:'Scenario '+n});
  else           addSecurity({type:'custom', name:'Scenario '+n});
  scheduleRun();
});
$('dupScenarioBtn').addEventListener('click', ()=>{ if(activeSecurityId!=null){ duplicateSecurity(activeSecurityId); scheduleRun(); } });
$('delScenarioBtn').addEventListener('click', ()=>{ if(activeSecurityId!=null){ removeSecurity(activeSecurityId); scheduleRun(); } });

/* ─── TICKER POOL WIRING ─── */
$('loadTickersBtn').addEventListener('click', loadTickerPool);
$('editTickersBtn').addEventListener('click', ()=>{ setPoolLocked(false); const i=$('tickerPoolInput'); if(i) i.focus(); });
{ const cb=$('clearPoolBtn'); if(cb) cb.addEventListener('click', clearPool); }
$('tickerPoolInput').addEventListener('keydown', e=>{
  // Enter loads; Shift+Enter inserts a newline.
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); loadTickerPool(); }
});

/* ─── CURRENCY CHANGE ─── */
$('currencySymbol').addEventListener('change',e=>{
  currentCurrencySymbol=e.target.value;
  const pfx=$('cfgAmountPrefix'); if(pfx) pfx.textContent=currentCurrencySymbol||'$';
  if(simResults.length){ updateTables(); updateEquityChart(); }
});
$('randomSeed').addEventListener('input',e=>{
  currentRandomSeed = sanitizeSeed(e.target.value);
  scheduleRun();
});

/* ─── DEFAULT DATE RANGE ─── */
(function initDates(){
  const end=new Date();
  const start=new Date(); start.setFullYear(start.getFullYear()-5);
  $('startDate').value=isoDate(start);
  $('endDate').value=isoDate(end);
})();

/* ─── TECHNICAL INDICATORS ─── */
// All indicators operate on the close-price series only (the data this tool
// stores). They are computed lazily — never on page load, only when a security
// actually uses a technical strategy or the user toggles the chart overlay.
function smaSeries(p,n){
  const out=new Array(p.length).fill(null);
  if(n<1) return out;
  let sum=0;
  for(let i=0;i<p.length;i++){ sum+=p[i]; if(i>=n) sum-=p[i-n]; if(i>=n-1) out[i]=sum/n; }
  return out;
}
function emaSeries(p,n){
  const out=new Array(p.length).fill(null);
  if(n<1||p.length<n) return out;
  const k=2/(n+1);
  let seed=0;
  for(let i=0;i<n;i++) seed+=p[i];
  let prev=seed/n; out[n-1]=prev;
  for(let i=n;i<p.length;i++){ prev=p[i]*k+prev*(1-k); out[i]=prev; }
  return out;
}
function maSeries(p,type,n){ return type==='ema'?emaSeries(p,n):smaSeries(p,n); }
function rsiSeries(p,n){
  const out=new Array(p.length).fill(null);
  if(p.length<n+1) return out;
  let gain=0,loss=0;
  for(let i=1;i<=n;i++){ const ch=p[i]-p[i-1]; if(ch>=0) gain+=ch; else loss-=ch; }
  let avgG=gain/n, avgL=loss/n;
  out[n]= avgL===0?100:100-100/(1+avgG/avgL);
  for(let i=n+1;i<p.length;i++){
    const ch=p[i]-p[i-1], g=ch>0?ch:0, l=ch<0?-ch:0;
    avgG=(avgG*(n-1)+g)/n; avgL=(avgL*(n-1)+l)/n;
    out[i]= avgL===0?100:100-100/(1+avgG/avgL);
  }
  return out;
}
function bollingerSeries(p,n,k){
  const mid=smaSeries(p,n);
  const upper=new Array(p.length).fill(null), lower=new Array(p.length).fill(null);
  for(let i=n-1;i<p.length;i++){
    let sq=0;
    for(let j=i-n+1;j<=i;j++){ const d=p[j]-mid[i]; sq+=d*d; }
    const sd=Math.sqrt(sq/n);
    upper[i]=mid[i]+k*sd; lower[i]=mid[i]-k*sd;
  }
  return {mid,upper,lower};
}
function macdSeries(p,fast,slow,signal){
  const ef=emaSeries(p,fast), es=emaSeries(p,slow);
  const macd=p.map((_,i)=> (ef[i]!=null&&es[i]!=null)? ef[i]-es[i] : null);
  const sig=new Array(p.length).fill(null);
  const k=2/(signal+1);
  let prev=null, count=0, seed=0;
  for(let i=0;i<p.length;i++){
    if(macd[i]==null) continue;
    count++;
    if(count<signal){ seed+=macd[i]; }
    else if(count===signal){ seed+=macd[i]; prev=seed/signal; sig[i]=prev; }
    else { prev=macd[i]*k+prev*(1-k); sig[i]=prev; }
  }
  const hist=p.map((_,i)=> (macd[i]!=null&&sig[i]!=null)? macd[i]-sig[i] : null);
  return {macd,signal:sig,hist};
}
// ADX from close prices only (high=low=close approximation), Wilder-smoothed.
function adxSeries(p,n){
  const len=p.length;
  const out=new Array(len).fill(null);
  if(len<2*n+1) return out;
  const tr=new Array(len).fill(0), pdm=new Array(len).fill(0), ndm=new Array(len).fill(0);
  for(let i=1;i<len;i++){
    const up=p[i]-p[i-1], down=p[i-1]-p[i];
    pdm[i]=(up>down&&up>0)?up:0;
    ndm[i]=(down>up&&down>0)?down:0;
    tr[i]=Math.abs(p[i]-p[i-1]);
  }
  let atr=0,apdm=0,andm=0;
  for(let i=1;i<=n;i++){ atr+=tr[i]; apdm+=pdm[i]; andm+=ndm[i]; }
  const dx=new Array(len).fill(null);
  for(let i=n+1;i<len;i++){
    atr=atr-atr/n+tr[i]; apdm=apdm-apdm/n+pdm[i]; andm=andm-andm/n+ndm[i];
    const pdi=atr===0?0:100*apdm/atr, ndi=atr===0?0:100*andm/atr;
    const sum=pdi+ndi;
    dx[i]= sum===0?0:100*Math.abs(pdi-ndi)/sum;
  }
  let cnt=0, dsum=0, prev=null;
  for(let i=0;i<len;i++){
    if(dx[i]==null) continue;
    cnt++;
    if(cnt<=n){ dsum+=dx[i]; if(cnt===n){ prev=dsum/n; out[i]=prev; } }
    else { prev=(prev*(n-1)+dx[i])/n; out[i]=prev; }
  }
  return out;
}

// Build the per-day buy-signal array (and the overlay lines) for a technical
// strategy. Returns { signal:[bool], lines:[{name,values,axis,dash,fade}] }.
function buildTech(prices, style, tech){
  const t=tech||{};
  const n=prices.length;
  const sig=new Array(n).fill(false);
  const lines=[];
  const crossUp=(a,b,i)=> a[i]!=null&&b[i]!=null&&a[i-1]!=null&&b[i-1]!=null&&a[i-1]<=b[i-1]&&a[i]>b[i];
  if(style==='tech-ma-cross'){
    const fast=maSeries(prices,t.fastMaType||'ema',t.fastMaLen||50);
    const slow=maSeries(prices,t.slowMaType||'sma',t.slowMaLen||200);
    for(let i=1;i<n;i++) if(crossUp(fast,slow,i)) sig[i]=true;
    lines.push({name:`${(t.fastMaType||'ema').toUpperCase()} ${t.fastMaLen||50}`,values:fast,axis:'price',dash:'dash',fade:0.7});
    lines.push({name:`${(t.slowMaType||'sma').toUpperCase()} ${t.slowMaLen||200}`,values:slow,axis:'price',dash:'dot',fade:0.45});
  } else if(style==='tech-rsi'){
    const r=rsiSeries(prices,t.rsiPeriod||14); const thr=t.rsiOversold??35;
    for(let i=0;i<n;i++) if(r[i]!=null&&r[i]<thr) sig[i]=true;
    lines.push({name:`RSI ${t.rsiPeriod||14}`,values:r,axis:'osc',dash:'dash',fade:0.75});
    lines.push({name:`Oversold ${thr}`,values:new Array(n).fill(thr),axis:'osc',dash:'dot',fade:0.4});
  } else if(style==='tech-bollinger'){
    const {mid,upper,lower}=bollingerSeries(prices,t.bbPeriod||20,t.bbStd||2);
    if((t.bbTrigger||'below')==='reclaim'){
      for(let i=1;i<n;i++) if(lower[i]!=null&&lower[i-1]!=null&&prices[i]>=lower[i]&&prices[i-1]<lower[i-1]) sig[i]=true;
    } else {
      for(let i=0;i<n;i++) if(lower[i]!=null&&prices[i]<lower[i]) sig[i]=true;
    }
    lines.push({name:'BB Upper',values:upper,axis:'price',dash:'dot',fade:0.4});
    lines.push({name:`BB Mid ${t.bbPeriod||20}`,values:mid,axis:'price',dash:'dash',fade:0.6});
    // The lower band fills up to the upper band (2 datasets back) so the area
    // between the bands reads as a shaded channel.
    lines.push({name:'BB Lower',values:lower,axis:'price',dash:'dot',fade:0.4,bandFill:true});
  } else if(style==='tech-macd-cross'){
    const {macd,signal}=macdSeries(prices,t.macdFast||12,t.macdSlow||26,t.macdSignal||9);
    for(let i=1;i<n;i++) if(crossUp(macd,signal,i)) sig[i]=true;
    lines.push({name:'MACD',values:macd,axis:'osc',dash:'dash',fade:0.75});
    lines.push({name:'Signal',values:signal,axis:'osc',dash:'dot',fade:0.45});
  } else if(style==='tech-macd-hist'){
    const {hist}=macdSeries(prices,t.macdFast||12,t.macdSlow||26,t.macdSignal||9);
    const thr=t.macdHistThreshold??0;
    for(let i=1;i<n;i++) if(hist[i]!=null&&hist[i-1]!=null&&hist[i]>thr&&hist[i-1]<=thr) sig[i]=true;
    // The histogram renders as MACD-style coloured bars (not a line), so flag it
    // for the chart layer; the threshold/zero line stays a thin reference.
    lines.push({name:'MACD Hist',values:hist,axis:'osc',bar:true});
    lines.push({name:`Threshold ${thr}`,values:new Array(n).fill(thr),axis:'osc',dash:'dot',fade:0.4});
  } else if(style==='tech-adx'){
    const a=adxSeries(prices,t.adxPeriod||14); const thr=t.adxThreshold??25;
    for(let i=0;i<n;i++) if(a[i]!=null&&a[i]>thr) sig[i]=true;
    lines.push({name:`ADX ${t.adxPeriod||14}`,values:a,axis:'osc',dash:'dash',fade:0.75});
    lines.push({name:`Threshold ${thr}`,values:new Array(n).fill(thr),axis:'osc',dash:'dot',fade:0.4});
  }
  return {signal:sig, lines};
}

// ─── PERIOD BUCKETING (calendar month or week) ───
// A stable Sunday-aligned week key (year + week-of-year), matching the scheme the
// fixed Weekly styles already use so every "weekly" feature buckets identically.
function isoWeekBucket(dateStr){
  const dt=parseDate(dateStr);
  const y=dt.getFullYear();
  const doy=Math.floor((dt-new Date(y,0,1))/86400000);
  const wk=Math.floor((doy+new Date(y,0,1).getDay())/7);
  return y+'-'+String(wk).padStart(2,'0');
}
function periodKey(dateStr, period){
  return period==='weekly' ? isoWeekBucket(dateStr) : dateStr.slice(0,7);
}
// Group trading-day indices into chronological per-period buckets (dates arrive
// sorted, so insertion order == chronological order).
function groupIndicesByPeriod(dates, period){
  const groups={};
  dates.forEach((d,i)=>{ const k=periodKey(d,period); (groups[k]||(groups[k]=[])).push(i); });
  return Object.values(groups);
}

// Pick one buy per period (month or week): the first day the signal fires, or —
// when "Invest at End of …" is on — the last trading day if it never fired.
function periodSignalDates(dates, signal, eom, period){
  const out=[];
  groupIndicesByPeriod(dates, period).forEach(idxs=>{
    let picked=-1;
    for(const i of idxs){ if(signal[i]){ picked=i; break; } }
    if(picked>=0) out.push(picked);
    else if(eom) out.push(idxs[idxs.length-1]);
  });
  return out;
}

/* ─── SIMULATION ENGINE ─── */
function getInvestmentDates(priceData, style, dayOrDate, momentumPct=5, momentumEOM=true, tech=null, techEOM=true, period='monthly'){
  const {dates, prices} = priceData;
  const dateIndex = {};
  dates.forEach((d,i)=>dateIndex[d]=i);
  const result=[]; // indices into priceData where purchase happens

  if(style==='monthly-date'){
    // Group by year-month, find closest trading day to dayOrDate
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{
      const target=dayOrDate;
      // find closest index
      let best=idxs[0];
      idxs.forEach(i=>{
        const day=parseInt(dates[i].slice(8,10));
        if(Math.abs(day-target)<Math.abs(parseInt(dates[best].slice(8,10))-target)) best=i;
      });
      result.push(best);
    });
  } else if(style==='monthly-top'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]>prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='monthly-bottom'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]<prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='weekly-day'){
    // Group by ISO week, find closest day to the chosen weekday.
    const targetDow=Math.min(7,Math.max(1,dayOrDate)); // 1=Mon..7=Sun (nearest trading day)
    groupIndicesByPeriod(dates,'weekly').forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{
        const dow=parseDate(dates[i]).getDay()||7;
        const bestDow=parseDate(dates[best]).getDay()||7;
        if(Math.abs(dow-targetDow)<Math.abs(bestDow-targetDow)) best=i;
      });
      result.push(best);
    });
  } else if(style==='weekly-top'){
    groupIndicesByPeriod(dates,'weekly').forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]>prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='weekly-bottom'){
    groupIndicesByPeriod(dates,'weekly').forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]<prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='momentum-peak'||style==='momentum-dip'){
    // Once per period (month or week): invest on the first day price moves the
    // set % from the period's opening price; otherwise skip (or buy at the end
    // of the period when "Invest at End of …" is on).
    const threshold=(momentumPct||5)/100;
    groupIndicesByPeriod(dates, period).forEach(idxs=>{
      const refPrice=prices[idxs[0]];
      let invested=false;
      for(const i of idxs){
        const p=prices[i];
        if(style==='momentum-peak'&&p>=refPrice*(1+threshold)){
          result.push(i); invested=true; break;
        } else if(style==='momentum-dip'&&p<=refPrice*(1-threshold)){
          result.push(i); invested=true; break;
        }
      }
      if(!invested&&momentumEOM) result.push(idxs[idxs.length-1]);
    });
  } else if(TECH_STYLES.includes(style)){
    const {signal}=buildTech(prices, style, tech||{});
    periodSignalDates(dates, signal, techEOM, period).forEach(i=>result.push(i));
  }

  // Remove duplicates, sort
  return [...new Set(result)].sort((a,b)=>a-b);
}

// Amount invested on a given date, applying the optional annual compounding
// increase. The increase steps up once per full year elapsed since `startStr`,
// so year 1 uses the base amount, year 2 uses base·(1+r), and so on.
function investAmountAt(base, yearlyIncreasePct, startStr, dateStr){
  const r=(yearlyIncreasePct||0)/100;
  if(!r) return base;
  const yrs=Math.floor((parseDate(dateStr)-parseDate(startStr))/(365.25*86400000));
  return base*Math.pow(1+r, Math.max(0,yrs));
}

function simulateSecurity(sec){
  const {dates, prices} = sec.priceData;
  const investIdxs = getInvestmentDates(sec.priceData, sec.style, sec.dayOrDate, sec.momentumPct, sec.momentumEOM, sec.tech, sec.techEOM, sec.period||'monthly');
  const investSet = new Set(investIdxs);
  const startStr = dates[0];
  const yinc = sec.yearlyIncrease||0;

  let totalUnits=0, totalDeposited=0;

  // Build a running state over all trading days
  const investRows=[];
  for(let i=0;i<dates.length;i++){
    if(investSet.has(i)){
      const price=prices[i];
      const amt=investAmountAt(sec.amount, yinc, startStr, dates[i]);
      const units=amt/price;
      totalUnits+=units;
      totalDeposited+=amt;
      investRows.push({
        date:dates[i], price, amountInvested:amt, unitsAdded:units,
        totalUnits, totalDeposited, equity:totalUnits*price,
        returnPct:(totalUnits*price-totalDeposited)/totalDeposited*100
      });
    }
  }

  // Also daily equity for chart
  let runUnits=0, runDeposited=0;
  const dailyRows=[];
  for(let i=0;i<dates.length;i++){
    if(investSet.has(i)){
      const amt=investAmountAt(sec.amount, yinc, startStr, dates[i]);
      runUnits+=amt/prices[i];
      runDeposited+=amt;
    }
    dailyRows.push({
      date:dates[i], price:prices[i],
      totalUnits:runUnits, totalDeposited:runDeposited,
      equity:runUnits*prices[i]
    });
  }

  return { investRows, dailyRows, finalEquity: runUnits*(prices[prices.length-1]||1), totalDeposited:runDeposited };
}

/* ─── RUN SIMULATION ─── */
async function runSimulation(){
  if(!securities.length){
    showWarning('Add at least one security to run simulation.');
    return;
  }

  const startDate=$('startDate').value;
  const endDate=$('endDate').value;
  if(!startDate||!endDate){ showWarning('Please set start and end dates.'); return; }

  const simBtn=$('simBtn');
  simBtn.disabled=true;
  simBtn.innerHTML='<span class="spinner"></span>Running…';

  try{
  showStatus($('fetchStatus'),'Preparing simulation...','loading');

  // Reset stale data before rebuilding this run.
  securities.forEach(sec => { sec.priceData = null; sec.loaded = false; });

  // Ticker data should already be pooled and cached (loaded up front in one
  // request). If anything is missing or the date range moved outside the cached
  // window, fetch ONLY those tickers — and do it in a SINGLE batched request
  // rather than one-by-one — so we keep Worker invocations to a minimum.
  const uniqueTickers = [...new Set(securities
    .filter(sec => sec.type==='ticker')
    .map(sec => String(sec.ticker||'').trim().toUpperCase())
    .filter(Boolean))];
  const missing = uniqueTickers.filter(t => !isTickerRangeCovered(t, startDate, endDate));
  if(missing.length){
    showStatus($('fetchStatus'),'Fetching '+missing.length+' ticker(s) in one request…','loading');
    const fetchStart = POOL_FETCH_START < startDate ? POOL_FETCH_START : startDate;
    const fetchEnd = isoDate(new Date()) > endDate ? isoDate(new Date()) : endDate;
    try {
      const map = await window.SharedYF.fetchPricesBatch(missing, fetchStart, fetchEnd);
      for(const t of missing){
        if(!storeBatchResult(t, map[t], fetchStart, fetchEnd)){
          showWarning('Could not load data for '+t+(map[t]&&map[t].error?': '+map[t].error:'')+'.');
        }
      }
      persistPriceCache(); renderPoolChips(); refreshTickerSelect(); updateRateInfo();
    } catch(e){
      showWarning('Could not load ticker data: '+e.message);
    }
  }

  // Prepare price data for every security.
  // Custom: regenerate GBM for the requested range (cheap, deterministic).
  // Ticker: assign cached slice for the selected range.
  for(const sec of securities){
    if(sec.type==='custom'){
      const secSeed = deriveSeed(currentRandomSeed, `${sec.name}|${sec.returnPct}|${sec.stdPct}|${sec.amount}|${sec.style}|${sec.dayOrDate}`);
      const secRng = createSeededRng(secSeed);
      sec.priceData = generateGBMPrices(startDate, endDate, sec.returnPct, sec.stdPct, 100, secRng);
      sec.loaded=true;
    } else {
      const statusEl = $(`secLoadStatus${sec.id}`);
      const slice = getCachedPriceSlice(sec.ticker, startDate, endDate);
      if(!slice){ showWarning('No data in selected range for '+sec.ticker+'.'); continue; }
      sec.priceData = slice;
      sec.loaded = true;
      if(statusEl){ statusEl.className='status-bar status-ok'; statusEl.textContent='✓ Loaded'; }
    }
  }

  // Find common date range
  const loadedSecs = securities.filter(s=>s.priceData&&s.priceData.dates.length);
  if(!loadedSecs.length){ showWarning('No securities with data loaded.'); return; }

  const latestStart = loadedSecs.map(s=>s.priceData.dates[0]).sort().pop();
  const earliestEnd = loadedSecs.map(s=>s.priceData.dates[s.priceData.dates.length-1]).sort()[0];

  if(latestStart>=earliestEnd){ showWarning('No overlapping date range between securities.'); return; }

  // Trim all to common range (carry OHLC along when present)
  for(const sec of loadedSecs){
    const pd=sec.priceData;
    const si=pd.dates.findIndex(d=>d>=latestStart);
    const ei=pd.dates.findLastIndex(d=>d<=earliestEnd);
    if(si<0||ei<0) continue;
    const trimmed={dates:pd.dates.slice(si,ei+1), prices:pd.prices.slice(si,ei+1)};
    if(pd.opens && pd.highs && pd.lows){
      trimmed.opens=pd.opens.slice(si,ei+1);
      trimmed.highs=pd.highs.slice(si,ei+1);
      trimmed.lows =pd.lows.slice(si,ei+1);
    }
    sec.priceData=trimmed;
  }

  showStatus($('dateRangeStatus'),`Date range: ${latestStart} → ${earliestEnd}`,'ok');

  // Run simulations
  simResults=[];
  for(const sec of loadedSecs){
    try {
      const res=simulateSecurity(sec);
      simResults.push({sec, ...res});
    } catch(e){
      console.error('Sim error for '+sec.name, e);
    }
  }

  if(!simResults.length){ showWarning('Simulation produced no results.'); return; }

  hideStatus($('fetchStatus'));
  updatePriceChart();
  updateEquityChart();
  updateTables();
  } finally {
    simBtn.disabled=false;
    updateSimBtn();
  }
}

/* ─── PRICE CHART ─── */
// Actual-price OHLC for a result, used by the candlestick plugin. Real OHLC is
// used when the source/cache provides it (custom GBM always does; tickers do
// once the Worker returns OHLC); otherwise candles are synthesised from close.
function buildOHLC(res){
  const closes=res.dailyRows.map(r=>r.price);
  const pd=res.sec.priceData||{};
  if(pd.opens && pd.highs && pd.lows && pd.opens.length===closes.length){
    return { o:pd.opens.slice(), h:pd.highs.slice(), l:pd.lows.slice(), c:closes, real:true };
  }
  const o=[],h=[],l=[];
  for(let i=0;i<closes.length;i++){
    const c=closes[i], open=i===0?c:closes[i-1], move=Math.abs(c-open);
    o.push(open);
    h.push(Math.max(open,c)+move*0.25);
    l.push(Math.max(1e-6,Math.min(open,c)-move*0.25));
  }
  return { o,h,l,c:closes, real:false };
}

// Candlestick renderer. Draws candles for any visible price dataset carrying
// _ohlc, and fits the price y-axis to the candles so wicks aren't clipped.
// Inactive unless the Candles toggle is on, so line mode is untouched.
const dcaCandlePlugin = {
  id:'dcaCandles',
  afterDataLimits(chart, args){
    if(!showCandles) return;
    const scale=args.scale;
    if(!scale || scale.id!=='y') return;
    // Only the price chart carries _ohlc datasets — leave the equity chart untouched.
    if(!chart.data.datasets.some(ds=>ds._ohlc)) return;
    // Fit the y-axis to whatever is inside the currently visible x-window rather
    // than the whole history, so the candles autoscale (fill the panel) as you
    // zoom or pan instead of staying pinned to the full range's high/low.
    const xs=chart.scales.x;
    const iMin = xs ? Math.floor(xs.min) : 0;
    const iMax = xs ? Math.ceil(xs.max) : Infinity;
    let lo=Infinity, hi=-Infinity;
    chart.data.datasets.forEach((ds,di)=>{
      if(!chart.isDatasetVisible(di)) return;
      // Oscillator overlays (RSI/MACD/ADX) live on their own axes — never fold
      // them into the price scale or they'd flatten the candles.
      if(typeof ds.yAxisID==='string' && ds.yAxisID.indexOf('yOsc_')===0) return;
      if(ds._ohlc){
        const {h,l}=ds._ohlc;
        const end=Math.min(h.length-1,iMax);
        for(let i=Math.max(0,iMin);i<=end;i++){ if(h[i]!=null&&h[i]>hi)hi=h[i]; if(l[i]!=null&&l[i]<lo)lo=l[i]; }
      } else {
        // Price-axis overlays/markers (moving averages, Bollinger bands, buy
        // triangles) — keep them in view too.
        const data=ds.data; const end=Math.min(data.length-1,iMax);
        for(let i=Math.max(0,iMin);i<=end;i++){ const v=data[i]; if(v==null) continue; if(v>hi)hi=v; if(v<lo)lo=v; }
      }
    });
    if(hi>lo){ const pad=(hi-lo)*0.04; scale.min=lo-pad; scale.max=hi+pad; }
  },
  afterDatasetsDraw(chart){
    if(!showCandles) return;
    if(!chart.data.datasets.some(ds=>ds._ohlc)) return; // not the price chart
    const x=chart.scales.x, y=chart.scales.y;
    if(!x||!y) return;
    const ctx=chart.ctx, area=chart.chartArea;
    const step=Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))||6;
    const w=Math.max(1, Math.min(step*0.7, 16));
    ctx.save();
    ctx.beginPath(); ctx.rect(area.left,area.top,area.right-area.left,area.bottom-area.top); ctx.clip();
    chart.data.datasets.forEach((ds,di)=>{
      if(!ds._ohlc || !chart.isDatasetVisible(di)) return;
      const {o,h,l,c}=ds._ohlc;
      for(let i=0;i<c.length;i++){
        if(c[i]==null||o[i]==null) continue;
        const px=x.getPixelForValue(i);
        if(px<area.left-w||px>area.right+w) continue;
        const up=c[i]>=o[i], col=up?CANDLE_UP:CANDLE_DOWN;
        ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(px,y.getPixelForValue(h[i])); ctx.lineTo(px,y.getPixelForValue(l[i])); ctx.stroke();
        const yO=y.getPixelForValue(o[i]), yC=y.getPixelForValue(c[i]);
        const top=Math.min(yO,yC), bot=Math.max(yO,yC);
        ctx.fillRect(px-w/2, top, w, Math.max(1,bot-top));
      }
    });
    ctx.restore();
  }
};
if(window.Chart && Chart.register) Chart.register(dcaCandlePlugin);

function updatePriceChart(){
  if(!simResults.length) return;
  const allDates=simResults[0].dailyRows.map(r=>r.date);
  const legendEl=$('priceLegend'); legendEl.innerHTML='';
  const gridColor=cssVar('--chart-grid'), mutedColor=cssVar('--chart-text'), textColor=cssVar('--text');

  // Each scenario is its OWN independent series (no ticker de-duplication), so
  // the same symbol used with different strategies/triggers shows as separate
  // lines you can toggle on individually.
  const series=simResults;

  // Reset to "first series only" whenever the scenario set changes; otherwise
  // keep the user's show/hide choices across rebuilds (theme, legend, toggles).
  if(series.length!==priceSeriesCount){
    priceHidden=new Set(series.map((_,i)=>i).filter(i=>i>0));
    priceSeriesCount=series.length;
  }
  priceHidden=new Set([...priceHidden].filter(i=>i<series.length));

  const visibleCount=series.reduce((n,_,i)=>n+(priceHidden.has(i)?0:1),0);
  // Show actual prices for a single visible series (or candlestick mode) and
  // normalise to base 100 only when two or more line series are compared.
  const normalize = !showCandles && visibleCount>=2;
  const priceVal=(res,price)=> normalize ? price/(res.dailyRows[0]?.price||1)*100 : price;

  const datasets=series.map((res,idx)=>{
    const color=getSecColor(res.sec);
    const label=res.sec.name;          // scenario name keeps same-ticker scenarios distinct
    const hidden=priceHidden.has(idx);
    const item=document.createElement('div');
    item.className='legend-item'+(hidden?' hidden':'');
    item.innerHTML=`<span class="dot" style="background:${color}"></span><span>${escapeHtml(label)}</span>`;
    // Toggling rebuilds the chart so normalisation (actual ↔ base-100) and the
    // axis title follow the new visible count.
    item.addEventListener('click',()=>{
      if(priceHidden.has(idx)) priceHidden.delete(idx); else priceHidden.add(idx);
      updatePriceChart();
    });
    legendEl.appendChild(item);
    const ds={ label, hidden,
      data:res.dailyRows.map(r=>priceVal(res,r.price)),
      borderColor: showCandles ? 'transparent' : color,
      backgroundColor:color+'22', borderWidth:2.5, pointRadius:0,
      pointHoverRadius:showCandles?0:5, tension:0.2, fill:false };
    if(showCandles) ds._ohlc=buildOHLC(res);
    return ds;
  });

  // Buy markers (▲) — one small upward triangle per purchase date, just below
  // each visible series' price. Only built while "Show Buy Date" is on.
  if(showBuyDates){
    let gMin=Infinity, gMax=-Infinity;
    series.forEach((res,idx)=>{ if(priceHidden.has(idx)) return; res.dailyRows.forEach(r=>{ const v=priceVal(res,r.price); if(v<gMin)gMin=v; if(v>gMax)gMax=v; }); });
    if(!isFinite(gMin)){ gMin=0; gMax=1; }
    const markerOffset=((gMax-gMin)||1)*0.05;
    series.forEach((res,idx)=>{
      const color=getSecColor(res.sec);
      const label=res.sec.name;
      const buyDates=new Set(res.investRows.map(r=>r.date));
      datasets.push({
        label:`${label} ▲ Buy`, hidden:priceHidden.has(idx),
        data:res.dailyRows.map(r=> buyDates.has(r.date) ? priceVal(res,r.price) - markerOffset : null),
        borderColor:color, backgroundColor:color, showLine:false, spanGaps:false,
        pointStyle:'triangle', pointRadius:2.5, pointHoverRadius:4,
        pointBorderColor:'#fff', pointBorderWidth:0.5, _marker:true
      });
    });
  }

  // Technical overlays, computed lazily and only while toggled on. Price-axis
  // overlays (moving averages, Bollinger bands) share the price grid; oscillator
  // indicators (RSI, MACD, ADX) each get their own grid stacked below the price
  // grid — same canvas, same X-axis — grouped by indicator family (OSC_GROUPS) so
  // securities using different indicators don't squash each other onto one scale.
  const oscGroups=new Map(); // group key -> axis title, in stacking order
  if(showTechIndicators){
    series.forEach((res,idx)=>{
      if(!TECH_STYLES.includes(res.sec.style)) return;
      // Skip hidden series so a hidden indicator strategy doesn't reserve an
      // empty oscillator panel (the chart rebuilds when visibility changes).
      if(priceHidden.has(idx)) return;
      const seriesPrices=res.dailyRows.map(r=>r.price);
      const base100=res.dailyRows[0]?.price||1;
      const ts=res._techSeries || (res._techSeries=buildTech(seriesPrices,res.sec.style,res.sec.tech||{}));
      const base=getSecColor(res.sec);
      const secLabel=res.sec.name;
      const hidden=false;
      const oscInfo=OSC_GROUPS[res.sec.style];
      ts.lines.forEach(ln=>{
        const isOsc=ln.axis==='osc'&&oscInfo;
        const yAxisID=isOsc?'yOsc_'+oscInfo.key:'y';
        if(isOsc&&!oscGroups.has(oscInfo.key)) oscGroups.set(oscInfo.key, oscInfo.name);
        if(ln.bar){
          // MACD histogram → coloured bars drawn from the zero line on the
          // oscillator grid (a real MACD panel, not a line). Pushed before its
          // threshold/zero reference line so that line sits on top.
          const cols=macdHistColors(ln.values);
          datasets.push({
            type:'bar', label:`${secLabel} · ${ln.name}`, hidden,
            data: ln.values.map(v=> v==null?null:v), yAxisID,
            backgroundColor:cols, borderColor:cols, borderWidth:0,
            categoryPercentage:1, barPercentage:1, _indicator:true, _hist:true
          });
          return;
        }
        const dash=ln.dash==='dot'?[2,3]:ln.dash==='dash'?[7,4]:[];
        // Price-axis overlays follow the same actual/normalised scaling as the
        // price line; oscillator overlays keep their raw values.
        const priceAxisVal=v=> v==null?null:(normalize ? v/base100*100 : v);
        const dsi={
          label:`${secLabel} · ${ln.name}`, hidden,
          data: isOsc ? ln.values.slice() : ln.values.map(priceAxisVal),
          yAxisID,
          borderColor:withAlpha(base, ln.fade||0.5),
          backgroundColor:'transparent', borderWidth:1.4, pointRadius:0, pointHoverRadius:3,
          borderDash:dash, tension:0.2, fill:false, spanGaps:true, _indicator:true
        };
        // Shade the area between the Bollinger bands (lower fills up to upper).
        if(ln.bandFill){ dsi.fill='-2'; dsi.backgroundColor=withAlpha(base,0.10); }
        datasets.push(dsi);
      });
    });
  }
  const oscGroupKeys=[...oscGroups.keys()];
  const hasOsc=oscGroupKeys.length>0;

  // Give the canvas extra height when oscillator grids are present so neither
  // the price grid nor the indicator grid(s) below it end up cramped.
  const wrap=$('priceCanvasWrap'); if(wrap) wrap.classList.toggle('has-osc', hasOsc);

  // Axis ticks / tooltips / subtitle all follow the current mode.
  const isOscDs=ds=> typeof ds.yAxisID==='string' && ds.yAxisID.indexOf('yOsc_')===0;
  const fmtY=v=> normalize ? fmt.num(v,2)+'%' : fmt.currency(v);
  const yCallback= normalize ? (val=>fmt.num(val,1)+'%') : (val=>fmt.currency(val,true));
  const fmtPt=i=> `${i.dataset.label}: ${isOscDs(i.dataset)?fmt.num(i.parsed.y,2):fmtY(i.parsed.y)}`;
  const yTitle= normalize ? 'Normalised Price (base 100)' : 'Price';
  const sub=$('priceChartSubtitle'); if(sub) sub.textContent = showCandles ? '(OHLC candlesticks)' : (normalize ? '(normalised to 100)' : '(actual price)');

  function buildPriceOpts(){
    // Drop the tick sitting exactly at the seam between two stacked grids so
    // its label doesn't overlap the label on the other side of the seam.
    const dropEdgeTick=(edge)=>scale=>{ scale.ticks=scale.ticks.filter(t=>t.value!==scale[edge]); };
    const numOsc=oscGroupKeys.length;
    const scales={
      x:{title:{display:true,text:'Date',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,maxTicksLimit:12,font:{family:'inherit',size:11},callback:v=>allDates[Number(v)]?.slice(0,7)||''},grid:{color:gridColor}},
      // Higher weight keeps the price scale above the oscillator grid(s) in the stack.
      y:{stack:hasOsc?'pricestack':undefined,stackWeight:hasOsc?3:undefined,weight:hasOsc?numOsc+1:undefined,position:'left',title:{display:true,text:yTitle,color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,font:{family:'inherit',size:11},callback:yCallback},grid:{color:gridColor},afterBuildTicks:hasOsc?dropEdgeTick('min'):undefined}
    };
    // One grid per indicator family, stacked below the price grid in order.
    oscGroupKeys.forEach((key,i)=>{
      const isLast=i===numOsc-1;
      scales['yOsc_'+key]={
        stack:'pricestack',stackWeight:1,weight:numOsc-i,position:'left',
        title:{display:true,text:oscGroups.get(key),color:mutedColor,font:{family:'inherit',size:11}},
        ticks:{color:mutedColor,font:{family:'inherit',size:11}},grid:{color:gridColor},
        afterBuildTicks:scale=>{ dropEdgeTick('max')(scale); if(!isLast) dropEdgeTick('min')(scale); }
      };
    });
    return {
      responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{display:false}, tooltip:{
        filter:item=>!item.dataset._marker,
        callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>'  '+fmtPt(ctx),
          afterBody(items){ const its=items.filter(i=>!i.dataset._marker); if(its.length) $('priceHoverBox').textContent=`${its[0].label}  —  `+its.map(fmtPt).join('  |  '); }},
        backgroundColor:cssVar('--panel')||'#11172a', titleColor:textColor, bodyColor:mutedColor, borderColor:gridColor, borderWidth:1, padding:10},
        zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},
      scales
    };
  }

  if(priceChartInstance){
    priceChartInstance.data.labels=allDates;
    priceChartInstance.data.datasets=datasets;
    priceChartInstance.options=buildPriceOpts();
    priceChartInstance.update('none');
  } else {
    priceChartInstance=new Chart($('priceCanvas'),{type:'line',data:{labels:allDates,datasets},options:buildPriceOpts()});
  }
}

/* ─── EQUITY CHART ─── */
function updateEquityChart(){
  if(!simResults.length) return;
  const allDates=simResults[0].dailyRows.map(r=>r.date);
  const legendEl=$('equityLegend'); legendEl.innerHTML='';
  const gridColor=cssVar('--chart-grid'), mutedColor=cssVar('--chart-text'), textColor=cssVar('--text');
  const dsIndexMap={};
  const datasets=[];

  simResults.forEach((res,idx)=>{
    const color=getSecColor(res.sec);
    dsIndexMap[idx]={equity:datasets.length};
    datasets.push({ label:res.sec.name+' Equity', data:res.dailyRows.map(r=>r.equity),
      borderColor:color, backgroundColor:color+'22', borderWidth:2.5, pointRadius:0, pointHoverRadius:5,
      tension:0.2, fill:false, _secIdx:idx, _type:'equity' });
    dsIndexMap[idx].deposit=datasets.length;
    datasets.push({ label:res.sec.name+' Deposited', data:res.dailyRows.map(r=>r.totalDeposited),
      borderColor:color, backgroundColor:'transparent', borderWidth:1.5, pointRadius:0, pointHoverRadius:4,
      tension:0.2, fill:false, borderDash:[5,4], _secIdx:idx, _type:'deposit' });

    const item=document.createElement('div');
    item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${color}"></span><span>${res.sec.name}</span>`;
    item.addEventListener('click',()=>{
      if(!equityChartInstance) return;
      const visible=equityChartInstance.isDatasetVisible(dsIndexMap[idx].equity);
      equityChartInstance.setDatasetVisibility(dsIndexMap[idx].equity,!visible);
      if(showDeposited) equityChartInstance.setDatasetVisibility(dsIndexMap[idx].deposit,!visible);
      item.classList.toggle('hidden',visible);
      equityChartInstance.update();
    });
    legendEl.appendChild(item);
  });

  const yCallback=val=>fmt.currency(val,true);
  const tooltipLabel=ctx=>equityChartInstance&&!equityChartInstance.isDatasetVisible(ctx.datasetIndex)?null:`  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`;

  function buildEquityOpts(){ return {
    responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:{
      filter:item=>equityChartInstance?equityChartInstance.isDatasetVisible(item.datasetIndex):true,
      callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>`  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`,
        afterBody(items){ if(items.length) $('equityHoverBox').textContent=`${items[0].label}  —  `+items.map(i=>`${i.dataset.label}: ${fmt.currency(i.parsed.y,true)}`).join('  |  '); }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:textColor, bodyColor:mutedColor, borderColor:gridColor, borderWidth:1, padding:10},
      zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},
    scales:{ x:{title:{display:true,text:'Date',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,maxTicksLimit:12,font:{family:'inherit',size:11},callback:v=>allDates[Number(v)]?.slice(0,7)||''},grid:{color:gridColor}},
              y:{title:{display:true,text:'Portfolio Value ('+currentCurrencySymbol+')',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,font:{family:'inherit',size:11},callback:yCallback},grid:{color:gridColor}}}
  };}

  if(equityChartInstance){
    equityChartInstance.data.labels=allDates; equityChartInstance.data.datasets=datasets;
    equityChartInstance.options.scales.x.ticks.color=mutedColor; equityChartInstance.options.scales.x.grid.color=gridColor;
    equityChartInstance.options.scales.x.ticks.callback=v=>allDates[Number(v)]?.slice(0,7)||'';
    equityChartInstance.options.scales.x.title.color=mutedColor;
    equityChartInstance.options.scales.y.ticks.color=mutedColor; equityChartInstance.options.scales.y.grid.color=gridColor;
    equityChartInstance.options.scales.y.ticks.callback=yCallback;
    equityChartInstance.options.scales.y.title.color=mutedColor;
    equityChartInstance.options.scales.y.title.text='Portfolio Value ('+currentCurrencySymbol+')';
    equityChartInstance.update('none');
    // re-apply deposited visibility
    datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  } else {
    equityChartInstance=new Chart($('equityCanvas'),{type:'line',data:{labels:allDates,datasets},options:buildEquityOpts()});
    datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  }
}

$('priceResetZoom').addEventListener('click',()=>{ if(priceChartInstance) priceChartInstance.resetZoom(); });
$('equityResetZoom').addEventListener('click',()=>{ if(equityChartInstance) equityChartInstance.resetZoom(); });
$('priceCanvas').addEventListener('mouseleave',()=>{ $('priceHoverBox').textContent='Hover to inspect data points.'; });
$('equityCanvas').addEventListener('mouseleave',()=>{ $('equityHoverBox').textContent='Hover to inspect data points.'; });

// The "Show Indicators" toggle is only meaningful when at least one security
// runs a technical-indicator strategy — hide it otherwise.
function updateTechToggleVisibility(){
  const wrap=$('techToggleWrap'); if(!wrap) return;
  const anyTech=securities.some(s=>TECH_STYLES.includes(s.style));
  wrap.style.display=anyTech?'':'none';
}

$('showDepositedToggle').addEventListener('change',e=>{
  showDeposited=e.target.checked;
  if(equityChartInstance&&simResults.length){
    equityChartInstance.data.datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  }
});

$('showTechToggle').addEventListener('change',e=>{
  showTechIndicators=e.target.checked;
  if(simResults.length) updatePriceChart();
});

$('showBuyDateToggle').addEventListener('change',e=>{
  showBuyDates=e.target.checked;
  if(simResults.length) updatePriceChart();
});

$('showCandleToggle').addEventListener('change',e=>{
  showCandles=e.target.checked;
  if(simResults.length) updatePriceChart();
});

$('showAdvancedToggle').addEventListener('change',e=>{
  showAdvanced=e.target.checked;
  // Toggle visibility in place — metrics are already rendered in each tile.
  document.querySelectorAll('#summaryGrid .adv-metrics').forEach(el=>{ el.style.display=showAdvanced?'grid':'none'; });
});

/* ─── FINAL SUMMARY GRID ───
   One tile per scenario. Final value is shown in full (e.g. $49,241, not $49k)
   so small differences between scenarios stay visible. Advanced risk/return
   metrics are appended to each tile and revealed by the "Advanced metrics"
   toggle. */
function renderSummary(){
  const sg=$('summaryGrid');
  if(!sg) return;
  sg.innerHTML='';
  if(!simResults.length) return;

  // Equal-weighted average of all securities' daily returns → "market" proxy
  // used for beta (Treynor). Index-aligned, matching the milestone table.
  const allRets=simResults.map(res=>dailyReturns(res.dailyRows.map(r=>r.price)));
  const n=Math.min(...allRets.map(a=>a.length));
  const marketReturns=[];
  for(let i=0;i<n;i++) marketReturns.push(statMean(allRets.map(a=>a[i])));

  const advStyle=`display:${showAdvanced?'grid':'none'}`;
  simResults.forEach(res=>{
    // Guard against a strategy that never invested in range (e.g. a technical
    // trigger that never fired with End-of-Period off) → no division by zero.
    const roi=res.totalDeposited>0?(res.finalEquity-res.totalDeposited)/res.totalDeposited:0;
    const m=computeMetrics(res, marketReturns);
    const metric=(label,val)=>`<div><span style="color:var(--muted)">${label}</span> <b>${val}</b></div>`;
    sg.innerHTML+=`
      <div class="tile" style="border-left:3px solid ${getSecColor(res.sec)}">
        <div class="label">${res.sec.name}</div>
        <div class="value">${fmt.currency(res.finalEquity)}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:3px">ROI: ${fmt.pct(roi)} | Dep: ${fmt.currency(res.totalDeposited)}</div>
        <div style="font-size:.75rem;color:var(--muted)">Trades: ${res.investRows.length}</div>
        <div class="adv-metrics" style="${advStyle}">
          ${metric('Sharpe', fmtRatio(m.sharpe))}
          ${metric('Sortino', fmtRatio(m.sortino))}
          ${metric('Treynor', fmtMetPct(m.treynor))}
          ${metric('CAGR (TWR)', fmtMetPct(m.cagrTwr))}
          ${metric('CAGR (MWR)', fmtMetPct(m.cagrMwr))}
        </div>
      </div>`;
  });
}

/* ─── TABLES ─── */
function updateTables(){
  if(!simResults.length) return;

  // Summary grid
  renderSummary();

  // Milestone table
  const allDates=simResults[0].dailyRows.map(r=>r.date);
  const totalDays=allDates.length;
  const milestoneIdxs=[0,
    Math.floor(totalDays*.1),Math.floor(totalDays*.2),Math.floor(totalDays*.3),
    Math.floor(totalDays*.5),Math.floor(totalDays*.7),Math.floor(totalDays*.9),totalDays-1
  ].filter((v,i,a)=>a.indexOf(v)===i);

  const thead=$('milestoneTable').querySelector('thead tr');
  thead.innerHTML=`<th>Period</th><th>Date</th>`+simResults.map(r=>`<th>${r.sec.name} Equity</th><th>ROI</th>`).join('');

  const tbody=$('milestoneBody');
  tbody.innerHTML='';
  milestoneIdxs.forEach(idx=>{
    const date=allDates[idx];
    const pct=Math.round(idx/(totalDays-1)*100);
    let row=`<td>${pct}%</td><td>${date}</td>`;
    simResults.forEach(res=>{
      const d=res.dailyRows[idx]||res.dailyRows[res.dailyRows.length-1];
      const roi=d.totalDeposited>0?(d.equity-d.totalDeposited)/d.totalDeposited:0;
      row+=`<td>${fmt.currency(d.equity,true)}</td><td style="color:${roi>=0?'var(--positive-em)':'var(--negative-em)'}">${fmt.pct(roi)}</td>`;
    });
    tbody.innerHTML+=`<tr>${row}</tr>`;
  });

  // Detail tabs
  const tabs=$('detailTabs');
  tabs.innerHTML='';
  simResults.forEach((res,i)=>{
    const btn=document.createElement('button');
    btn.className='tab-btn'+(i===activeDetailSec?' active':'');
    btn.textContent=res.sec.name;
    btn.addEventListener('click',()=>{
      tabs.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeDetailSec=i;
      renderDetailTable(i);
    });
    tabs.appendChild(btn);
  });
  renderDetailTable(activeDetailSec<simResults.length?activeDetailSec:0);

  latestRows=simResults[0].dailyRows;
}

function renderDetailTable(idx){
  const res=simResults[idx];
  if(!res) return;
  const tbody=$('detailBody');
  tbody.innerHTML='';
  res.investRows.forEach(r=>{
    const color=r.returnPct>=0?'var(--positive-em)':'var(--negative-em)';
    tbody.innerHTML+=`<tr>
      <td>${r.date}</td>
      <td>${fmt.currency(r.price)}</td>
      <td>${fmt.currency(r.amountInvested)}</td>
      <td>${r.unitsAdded.toFixed(6)}</td>
      <td>${r.totalUnits.toFixed(6)}</td>
      <td>${fmt.currency(r.equity)}</td>
      <td style="color:${color}">${fmt.pct(r.returnPct/100)}</td>
    </tr>`;
  });
  if(!res.investRows.length) tbody.innerHTML='<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:20px">No investment dates in range.</td></tr>';
}

/* ─── THEME TOGGLE ─── */
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
  if(simResults.length){ updatePriceChart(); updateEquityChart(); }
  renderSecList();
});

/* ─── SIMULATE BUTTON ─── */
$('simBtn').addEventListener('click', runSimulation);

/* ─── RESET ─── */
$('resetBtn').addEventListener('click',()=>{
  securities=[]; simResults=[]; latestRows=[]; priceCache={}; tickerFetchInFlight={};
  secIdCounter=0; activeSecurityId=null;
  currentCurrencySymbol='$';
  currentRandomSeed=DEFAULT_RANDOM_SEED;
  // Reset price-chart view state (candles off, "first only" default restored).
  showCandles=false; priceHidden=new Set(); priceSeriesCount=-1;
  { const ct=$('showCandleToggle'); if(ct) ct.checked=false; }
  if(priceChartInstance){ priceChartInstance.destroy(); priceChartInstance=null; }
  if(equityChartInstance){ equityChartInstance.destroy(); equityChartInstance=null; }
  renderSecList();
  $('summaryGrid').innerHTML='';
  $('milestoneBody').innerHTML='<tr><td colspan="8" style="color:var(--muted);text-align:center;padding:20px">Add securities to see milestones.</td></tr>';
  $('detailBody').innerHTML='<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:20px">Add securities to see detailed data.</td></tr>';
  $('detailTabs').innerHTML='';
  $('priceLegend').innerHTML=''; $('equityLegend').innerHTML='';
  $('priceHoverBox').textContent='Add securities and run to view price data.';
  $('equityHoverBox').textContent='Add securities and run to view equity data.';
  $('currencySymbol').value='$';
  $('randomSeed').value=DEFAULT_RANDOM_SEED;
  hideStatus($('fetchStatus')); hideStatus($('dateRangeStatus')); hideWarning();
  const poolInp=$('tickerPoolInput'); if(poolInp) poolInp.value='';
  setPoolLocked(false); hideStatus($('poolStatus')); renderPoolChips();
  document.querySelectorAll('.quick-start-btn').forEach(b=>b.classList.remove('active'));
  initializeDefaultSecurities();
  runSimulation();
});

/* ─── QUICK START PRESETS ─── */
// One-click worked examples. Each rebuilds the securities list with live-ticker
// securities, then runs the simulation so real Yahoo Finance prices are fetched
// (no simulated/custom data). Ideas: schedule, asset class, and instrument type.
const QUICK_START_PRESETS = {
  'monthly-weekly':[
    {type:'ticker', ticker:'SPY', name:'SPY — $520 / month', amount:520, style:'monthly-date', dayOrDate:1},
    {type:'ticker', ticker:'SPY', name:'SPY — $120 / week',  amount:120, style:'weekly-day',  dayOrDate:1},
  ],
  'equity-mmf':[
    {type:'ticker', ticker:'DHHF.AX', name:'DHHF.AX — Equity ETF',       amount:500, style:'monthly-date', dayOrDate:1},
    {type:'ticker', ticker:'AAA.AX',  name:'AAA.AX — Money Market Fund', amount:500, style:'monthly-date', dayOrDate:1},
  ],
  'stock-etf':[
    {type:'ticker', ticker:'AAPL', name:'AAPL — Individual Stock', amount:500, style:'monthly-date', dayOrDate:1},
    {type:'ticker', ticker:'SPY',  name:'SPY — ETF',               amount:500, style:'monthly-date', dayOrDate:1},
  ],
};

async function applyQuickStart(key){
  const defs = QUICK_START_PRESETS[key];
  if(!defs) return;
  // Rebuild the securities list from the preset (keep cached prices for speed).
  securities=[]; simResults=[]; latestRows=[]; secIdCounter=0;
  hideWarning();
  defs.forEach(d=> addSecurity(d));
  const secTabBtn=document.querySelector('.ctrl-tab[data-tab="securities"]');
  if(secTabBtn && !secTabBtn.classList.contains('active')) secTabBtn.click();
  renderSecList();
  document.querySelectorAll('.quick-start-btn').forEach(b=>b.classList.toggle('active', b.dataset.preset===key));
  await runSimulation();
}

document.querySelectorAll('.quick-start-btn').forEach(btn=>{
  btn.addEventListener('click', async()=>{
    if(btn.disabled) return;
    const all=[...document.querySelectorAll('.quick-start-btn')];
    all.forEach(b=>b.disabled=true);
    try { await applyQuickStart(btn.dataset.preset); }
    finally { all.forEach(b=>b.disabled=false); }
  });
});

/* ─── DOWNLOAD CHART PNG ─── */
function downloadChartPng(canvasId, filename, chartTitle, legendId, shouldDownload = true) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const OUT = 3;
  const chartW = Math.round(src.width / dpr * OUT);
  const chartH = Math.round(src.height / dpr * OUT);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = '"DM Sans", sans-serif';

  // Collect visible legend items from HTML legend element
  const legendItems = [];
  if(legendId){
    const legendEl = document.getElementById(legendId);
    if(legendEl){
      legendEl.querySelectorAll('.legend-item:not(.hidden)').forEach(item => {
        const dot = item.querySelector('.dot');
        const label = item.textContent.trim();
        const color = dot ? window.getComputedStyle(dot).backgroundColor : '#888888';
        if(label) legendItems.push({ label, color });
      });
    }
  }

  const titleFontPx = Math.round(14 * OUT);
  const legendFontPx = Math.round(11 * OUT);
  const titleH = chartTitle ? Math.round(40 * OUT) : 0;
  const legendH = legendItems.length ? Math.round(34 * OUT) : 0;

  const tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH;
  const ctx = tmp.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  if(chartTitle){
    ctx.font = `700 ${titleFontPx}px ${FONT}`;
    ctx.fillStyle = fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chartTitle, tmp.width / 2, titleH / 2);
  }

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
    const wmText = 'Made using tool.adjiebrotots.com/dcasimulator';
    const wmX = tmp.width - Math.round(12 * OUT);
    const wmY = tmp.height - Math.round(12 * OUT);
    const wmTextW = ctx.measureText(wmText).width;
    const wmLogoSize = Math.round(13 * OUT);
    if(wmLogoImg.complete && wmLogoImg.naturalWidth){
      ctx.drawImage(wmLogoImg, wmX - wmTextW - Math.round(4 * OUT) - wmLogoSize, wmY - wmLogoSize + Math.round(2 * OUT), wmLogoSize, wmLogoSize);
    }
    ctx.fillText(wmText, wmX, wmY);
  }
  ctx.restore();

  if(shouldDownload){
    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }
  return tmp;
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function downloadChartSvg(canvasId, filename, chartTitle, legendId, legendItemsOverride) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const legendItems = legendItemsOverride ? legendItemsOverride.slice() : [];
  if(!legendItemsOverride && legendId){
    const legendEl = document.getElementById(legendId);
    if(legendEl){
      legendEl.querySelectorAll('.legend-item:not(.hidden)').forEach(item => {
        const dot = item.querySelector('.dot');
        const label = item.textContent.trim();
        const color = dot ? window.getComputedStyle(dot).backgroundColor : '#888888';
        if(label) legendItems.push({ label, color });
      });
    }
  }
  const titleH = chartTitle ? 40 : 0;
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
  if(chartTitle){
    const t = document.createElementNS(NS,'text');
    t.setAttribute('x',svgW/2); t.setAttribute('y',titleH/2);
    t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
    t.setAttribute('font-family',FONT); t.setAttribute('font-size','14'); t.setAttribute('font-weight','700'); t.setAttribute('fill',fgColor);
    t.textContent = chartTitle; svg.appendChild(t);
  }
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
  wmLogo.setAttributeNS('http://www.w3.org/1999/xlink','href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize);
  wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', svgW - 12 - wmTextW - 4 - wmLogoSize);
  wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  svg.appendChild(wmLogo);
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
// Export title follows the current price-chart mode (actual / normalised / candles).
function priceChartExportTitle(){
  const sub=$('priceChartSubtitle'); const note=sub&&sub.textContent?' '+sub.textContent.trim():'';
  return 'DCA Scenario Explorer — Security Prices'+note;
}
$('pricePngBtn').addEventListener('click', () => downloadChartPng('priceCanvas', 'dca_price_chart.png', priceChartExportTitle(), 'priceLegend'));
$('priceCopyPngBtn').addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('priceCanvas', 'dca_price_chart.png', priceChartExportTitle(), 'priceLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('equityPngBtn').addEventListener('click', () => downloadChartPng('equityCanvas', 'dca_portfolio_chart.png', 'DCA Scenario Explorer — Portfolio Value', 'equityLegend'));
$('equityCopyPngBtn').addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('equityCanvas', 'dca_portfolio_chart.png', 'DCA Scenario Explorer — Portfolio Value', 'equityLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('priceSvgBtn').addEventListener('click', () => downloadChartSvg('priceCanvas', 'dca_price_chart.svg', priceChartExportTitle(), 'priceLegend'));
$('equitySvgBtn').addEventListener('click', () => downloadChartSvg('equityCanvas', 'dca_portfolio_chart.svg', 'DCA Scenario Explorer — Portfolio Value', 'equityLegend'));

/* ─── DOWNLOAD CSV (Detailed Breakdown of active tab) ─── */
$('downloadBtn').addEventListener('click',()=>{
  if(!simResults.length){ showWarning('Run simulation first.'); return; }
  const idx=activeDetailSec<simResults.length?activeDetailSec:0;
  const res=simResults[idx]; if(!res) return;
  const headers=['Date','Price','Amount_Invested','Units_Added','Total_Units','Equity','Return_Pct'];
  const lines=res.investRows.map(r=>[r.date,r.price.toFixed(4),r.amountInvested.toFixed(2),
    r.unitsAdded.toFixed(6),r.totalUnits.toFixed(6),r.equity.toFixed(2),r.returnPct.toFixed(2)].join(','));
  const csv='# Made using tool.adjiebrotots.com/dcasimulator\n'+[headers.join(','),...lines].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`dca_${res.sec.name.replace(/[^a-z0-9]/gi,'_')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
});

/* ─── WARNINGS ─── */
function showWarning(msg){ const w=$('mainWarning'); w.style.display='block'; w.textContent=msg; }
function hideWarning(){ const w=$('mainWarning'); w.style.display='none'; }

/* ─── CTRL TABS ─── */
document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
    updateSimBtn();
  });
});

/* ─── INIT: Add default securities ─── */
function initializeDefaultSecurities(){
  addSecurity({type:'custom',name:'S&P500',returnPct:10,stdPct:18,amount:500,style:'monthly-date',dayOrDate:1});
  addSecurity({type:'custom',name:'Risk-Free 5%',returnPct:5,stdPct:0.5,amount:500,style:'monthly-date',dayOrDate:1});
}

// Restore any previously cached price history so reloads/return visits cost
// zero Worker requests, then reflect it in the pool UI.
loadPersistedCache();
renderPoolChips();
refreshTickerSelect();
updateRateInfo();
updateBtnRow();

initializeDefaultSecurities();
runSimulation();

})();
