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
/* Scenario colours. Scenarios are options a reader is weighing, so they take
   the neutral sequence (SharedPalette): blue, gold, teal, rose, then purple and
   a light blue. Red stays for direction: a price falling, a loss. A scenario
   keeps its slot, resolved in the current theme, until the reader picks a
   colour on its tab; a picked colour is kept in both themes. A slot that
   resolves to a colour an earlier slot already has is skipped. */
const SCENARIO_COLORS = ['--line-a','--gold','--line-c','--line-d','--line-e','--line-f'];
const SCENARIO_COLORS_FALLBACK = ['#5A91E8','#B45309','#2E8B57','#b45309','#7c3aed','#0891b2'];
// The colours every scenario was given before the palette. A saved file or a
// cached session that carries one of these never picked it, so it opens on
// the palette instead of on red.
const LEGACY_COLOR_HEX = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4'];
const COLOR_NAMES     = ['Blue','Gold','Teal','Rose','Purple','Light blue'];
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
// MACD histogram bar colours - the TradingView-style 4-colour scheme: a
// saturated shade while a bar grows away from the zero line and a faded shade
// while it shrinks back toward it (green above zero, red below).
// (The up and down shades come from upDownColors(), so they follow the theme.)
const DEFAULT_RANDOM_SEED = 25823952204;
// What each technical style reads until the reader changes it.
const TECH_DEFAULTS = {
  fastMaType:'ema', fastMaLen:50, slowMaType:'sma', slowMaLen:200,
  rsiPeriod:14, rsiOversold:35,
  bbPeriod:20, bbStd:2, bbTrigger:'below',
  macdFast:12, macdSlow:26, macdSignal:9, macdHistThreshold:0,
  adxPeriod:14, adxThreshold:25
};
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
let showAdvanced = false;       // Final Summary: reveal Sharpe/Sortino/CAGR rows
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
const DEFAULT_RISK_FREE_RATE = 4;          // % p.a., baseline for Sharpe/Sortino
let currentRiskFreeRate = DEFAULT_RISK_FREE_RATE;
// Settings > Trade at: where a decision fills (see SharedTA.execPlan). Next
// day's open by default: review in the evening, place the order next morning.
const DEFAULT_EXEC_TIMING = 'next-open';
let currentExecTiming = DEFAULT_EXEC_TIMING;

// Optimise mode (see OPTIMISE below): the settings swept on the active scenario,
// and the sweep on the board (null while the board shows a comparison).
let optVars = [];                // [{key, start, end, steps, pick}], at most two
let optResult = null;
let optPick = [0, 0];            // which tested values the charts below the sweep show
let optPickWanted = null;        // a saved file's pick, applied once its sweep has run
let optAbort = false;            // Cancel pressed while a sweep is running
let runInFlight = false, editedInFlight = false;

/* ─── PRICE CACHE ─── */
// Keyed by ticker. Stores the widest date range ever fetched so simulations
// can filter from memory without re-fetching (only expand when needed).
let priceCache = {};
// { 'AAPL': { dates: [...], prices: [...], cachedStart: 'YYYY-MM-DD', cachedEnd: 'YYYY-MM-DD' } }
let tickerFetchInFlight = {};

/* ─── HELPERS ─── */
const $ = id => document.getElementById(id);
function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }
function isHexColor(v){ return typeof v==='string' && /^#[0-9a-fA-F]{6}$/.test(v); }
function scenarioPalette(){
  const seen={}, out=[];
  SCENARIO_COLORS.forEach((v,k)=>{ const c=cssVar(v)||SCENARIO_COLORS_FALLBACK[k]; const key=c.toLowerCase(); if(!seen[key]){ seen[key]=1; out.push(c); } });
  return out;
}
function slotColor(slot){ const l=scenarioPalette(), n=l.length; return l[(((slot|0)%n)+n)%n]; }
// Everything that draws or labels a scenario asks here, so its tab, its lines,
// its markers and its summary tile can never disagree.
function getSecColor(sec){ return isHexColor(sec.colorHex) ? sec.colorHex : slotColor(sec.colorSlot); }
// A colour a reader actually picked, or null for "follow the palette".
function pickedColor(hex){ return isHexColor(hex) && !LEGACY_COLOR_HEX.includes(hex.toLowerCase()) ? hex : null; }
// Up and down: the site's green and red, read from the theme, for candlesticks
// and the MACD histogram alike.
function upDownColors(){ return { up: cssVar('--line-c')||'#2E8B57', down: cssVar('--line-b')||'#E63939' }; }
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
// the zero line, faded while it shrinks back toward it (green ≥0, red <0) - the
// standard 4-colour MACD histogram scheme.
function macdHistColors(values){
  const ud=upDownColors();
  const c={ upStrong:ud.up, upFaint:withAlpha(ud.up,0.42), downStrong:ud.down, downFaint:withAlpha(ud.down,0.42) };
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

/* ── The Simulate gate ──────────────────────────────────────────────────────
   A run fetches price history and walks every scenario day by day, so it is far
   too much work to repeat on a keystroke: the form does not run the engine,
   ▶ Simulate does. That only works if the page is honest about it. The moment
   an input changes, the board below steps back and the button steps forward, so
   nobody reads a chart that no longer belongs to the numbers on screen. Nothing
   is marked before the first run, because there is no answer to doubt yet. */
let stale=false;
function markStale(){
  // An edit made while a sweep is running belongs to the next run, not this one.
  if(runInFlight) editedInFlight=true;
  if(stale || !simResults.length) return;
  stale=true;
  document.body.classList.add('is-stale');
  const b=$('simBtn'); if(b) b.classList.add('needs-run');
  renderStaleNote();
}
function markFresh(){
  if(!stale) return;
  stale=false;
  document.body.classList.remove('is-stale');
  const b=$('simBtn'); if(b) b.classList.remove('needs-run');
  renderStaleNote();
}
function scheduleRun(){ markStale(); } // simulation is manual via ▶ Simulate

// A scenario's name is a label, not an assumption, so a rename redraws the
// board in place rather than sending it out of date.
function refreshResultLabels(){
  if(!simResults.length) return;
  // A sweep on the board names and colours its runs after the scenario it swept.
  if(optResult){
    const s=securities.find(x=>x.id===optResult.sid);
    if(s){ optResult.name=s.name; Object.assign(optResult.S0, {name:s.name, colorHex:s.colorHex, colorSlot:s.colorSlot}); }
    updateOptChart(); showOptDetail(); renderStaleNote();
    return;
  }
  updatePriceChart(); updateEquityChart(); updateTables();
}

function getActiveTab(){ const t=document.querySelector('.ctrl-tab.active'); return t?t.dataset.tab:'securities'; }
function updateSimBtn(){ const b=$('simBtn'); if(!b)return; if(b.dataset.running!=='1') b.textContent=simBtnLabel(); updateBtnRow(); }
// On the Data tab the bottom action becomes "Load tickers" (it consumes the Date
// Range below and you can't simulate from here anyway); other tabs show Simulate.
function updateBtnRow(){
  const dataTab = getActiveTab()==='data';
  { const b=$('simBtn'); if(b) b.style.display=dataTab?'none':''; }
  { const c=$('optCancelBtn'); if(c) c.style.display=(!dataTab && optVars.length)?'':'none'; }
  // On the Data tab the bottom action mirrors the chosen download mode: "Load
  // tickers" for Real, "Add Simulated Asset" for Simulated. Other tabs show Simulate.
  const realMode=(typeof dataMode==='undefined' || dataMode==='real');
  const lb=$('loadTickersBtn'); if(lb) lb.style.display=(dataTab && realMode)?'':'none';
  const sb=$('addSimBtn'); if(sb) sb.style.display=(dataTab && !realMode)?'':'none';
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
  // Always a fraction: 1.5 is 150%. Guessing fraction-or-percent from the size
  // printed any ROI above 100% as 1.50%.
  pct(v,d=2){ return (Number(v||0)*100).toFixed(d)+'%'; },
  num(v,d=0){ return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); },
  date(d){ return d instanceof Date ? d.toISOString().slice(0,10) : d; },
};

/* ─── ADVANCED METRICS ───
   Risk/return statistics shown in the Final Summary when "Advanced metrics" is on.
   - Sharpe / Sortino use daily time-weighted (price) returns above the risk-free
     rate set in Settings (Risk-Free Rate, default 4% p.a.).
   - CAGR (TWR) annualises the geometric daily return net of each day's deposit.
   - CAGR (MWR) is the annualised IRR of actual deposits → final equity. */
const TRADING_DAYS = 252;
function statMean(a){ return a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0; }
function statStdev(a){ if(a.length<2) return 0; const m=statMean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1)); }
function downsideDev(a,mar=0){ if(!a.length) return 0; const d=a.map(x=>Math.min(0,x-mar)); return Math.sqrt(d.reduce((s,x)=>s+x*x,0)/a.length); }
// Annualised IRR (money-weighted return) of dated cash flows via bisection.
// flows: [{date:Date, amount}] - negative = invested, positive = received.
function xirr(flows){
  if(flows.length<2) return null;
  // An IRR only exists when money actually goes out and comes back (a set of
  // all-zero flows, e.g. a contribution of 0, otherwise bisects to a nonsense rate).
  if(!flows.some(f=>f.amount<0) || !flows.some(f=>f.amount>0)) return null;
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
function computeMetrics(res){
  // A denominator this small means the series has no measurable variation, so the
  // ratio is meaningless (floating-point noise would print a number in the
  // trillions). Show "-" instead.
  const MIN_DEV = 1e-9;
  const days=res.dailyRows;
  // Everything time-weighted is anchored to the first day money is actually at
  // work. Price moves before the first buy are not part of the result, and
  // neither is the time they took, so the growth window and the annualisation
  // window share one basis. This is also what the portfolio tool measures, which
  // keeps a single 100% holding there identical to a scenario here.
  const start=days.findIndex(r=>r.equity>0);
  const held=start>=0 ? days.slice(start) : [];
  // Each day's return with that day's deposit taken out, the Portfolio tool's
  // definition. With fills at the close it is the asset's own close-to-close
  // return; with a fill at the open it also carries the new money's open-to-close
  // move, which a plain price return would miss.
  const rets=[];
  for(let k=1;k<held.length;k++){
    const prev=held[k-1].equity, flow=held[k].totalDeposited-held[k-1].totalDeposited;
    rets.push(prev>0 ? (held[k].equity-flow)/prev-1 : 0);
  }
  // Daily risk-free rate derived from the annual rate set in Settings.
  const rf=Math.pow(1+currentRiskFreeRate/100, 1/TRADING_DAYS)-1;
  const exc=rets.map(r=>r-rf);
  const sd=statStdev(rets), dd=downsideDev(exc,0);
  const sharpe = sd>MIN_DEV ? statMean(exc)/sd*Math.sqrt(TRADING_DAYS) : null;
  const sortino= dd>MIN_DEV ? statMean(exc)/dd*Math.sqrt(TRADING_DAYS) : null;
  const years=held.length ? (parseDate(held[held.length-1].date)-parseDate(held[0].date))/(365.25*86400000) : 0;
  const growth=rets.reduce((g,r)=>g*(1+r),1);
  const cagrTwr = (years>0 && growth>0) ? Math.pow(growth,1/years)-1 : null;
  const flows=res.investRows.map(r=>({date:parseDate(r.date), amount:-r.amountInvested}));
  if(flows.length && res.finalEquity>0) flows.push({date:parseDate(days[days.length-1].date), amount:res.finalEquity});
  const cagrMwr = xirr(flows);
  return {sharpe, sortino, cagrTwr, cagrMwr};
}
const fmtRatio  = v => (v==null||!isFinite(v)) ? ' - ' : v.toFixed(2);
// Takes a fraction, like fmt.pct; null or non-finite reads as ' - '.
const fmtMetPct = v => (v==null||!isFinite(v)) ? ' - ' : (v*100).toFixed(2)+'%';
// Hover explanations for each advanced metric (avoid double quotes - used in data-tip).
const METRIC_TIPS = {
  sharpe:  '<strong>Sharpe:</strong> return above the risk-free rate, divided by how much the returns bounce around. Annualised from daily returns. Higher is better.',
  sortino: '<strong>Sortino:</strong> Sharpe counting downside only, so upside swings are not treated as risk.',
  twr:     '<strong>CAGR (TWR):</strong> compound annual growth of the holding from the first buy onward, each day measured net of that day’s deposit.',
  mwr:     '<strong>CAGR (MWR):</strong> compound annual growth of your own money, the IRR of your real deposits against your final equity.',
};
const metricCell = (label,val,tip)=>`<div><span data-tip="${tip}" style="color:var(--muted);cursor:help;border-bottom:1px dotted var(--border)">${label}</span> <b>${val}</b></div>`;

/* ─── DATE UTILS ─── */
function parseDate(s){ const [y,m,d]=s.split('-'); return new Date(+y,+m-1,+d); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function isoDate(d){ return d.toISOString().slice(0,10); }

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
    // isoDate() emits the UTC calendar date, so the weekend filter and the day
    // step must be UTC too — otherwise users west of UTC drop Mondays and gain
    // Saturday-dated points (the date axis would depend on the local timezone).
    const dow=d.getUTCDay();
    if(dow!==0&&dow!==6){
      dates.push(isoDate(d));
      prices.push(price);
      // GBM step
      const z=(randomFn()*2-1)+(randomFn()*2-1)+(randomFn()*2-1); // approx normal
      price=price*Math.exp((mu-0.5*sigma*sigma)*dt+sigma*Math.sqrt(dt)*z);
    }
    d=new Date(d.getTime()+86400000);
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
// The fetch engine (single self-hosted Cloudflare Worker, batched requests,
// retries) lives in shared.js so the simulator and the portfolio tool share one
// hardened implementation. The Worker source is yf-proxy-worker.js; point the
// client at a redeployed one with
// SharedYF.setEndpoint('https://NAME.SUBDOMAIN.workers.dev').
async function fetchYahooFinance(ticker, startDate, endDate){
  if(!window.SharedYF) throw new Error('Market data engine not loaded (shared.js)');
  return window.SharedYF.fetchPrices(ticker, startDate, endDate);
}

/* ─── SECURITY MANAGEMENT ─── */
function getActiveSec(){ return securities.find(s=>s.id===activeSecurityId) || null; }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// " ($)" after an axis or a note, or nothing when the currency is set to None.
function symInBrackets(){ return currentCurrencySymbol ? ' ('+currentCurrencySymbol+')' : ''; }

// Wire a standardised number/money input (the shared affix-input design):
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
  // Its palette slot: the one a saved file names, else its place in the list.
  const slot = Number.isInteger(cfg.colorSlot) && cfg.colorSlot >= 0 ? cfg.colorSlot : securities.length;
  const picked = pickedColor(cfg.colorHex);
  securities.forEach(s => { s.open = false; });
  const sec = {
    id, colorSlot: slot, colorName: COLOR_NAMES[slot % COLOR_NAMES.length],
    colorHex: picked,
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
  sec.tech = Object.assign({}, TECH_DEFAULTS, cfg.tech||{});
  // The cfg spread above may carry an old default colour or a colour variable
  // from an older file: what the scenario shows is its slot or a picked colour.
  sec.colorHex = picked; sec.colorSlot = slot; delete sec.colorVar;
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
  const slot = securities.length;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = ++secIdCounter;
  copy.name = src.name + ' (copy)';
  copy.colorSlot = slot;
  copy.colorName = COLOR_NAMES[slot % COLOR_NAMES.length];
  copy.colorHex = null;
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

/* ─── SCENARIO BAR - one tab per scenario (click to edit, double-click to rename) ─── */
function renderScenarioBar(){
  const el=$('scenarioTabs'); if(!el) return;
  // Detach the + Add button before clearing so it can be re-appended right after
  // the last scenario tab (so it flows/wraps with the tabs, matching the portfolio
  // tool) - its click listener stays intact across re-renders.
  const addBtn=$('addScenarioBtn');
  el.innerHTML='';
  securities.forEach(sec=>{
    const tab=document.createElement('div');
    tab.className='sc-tab'+(sec.id===activeSecurityId?' active':'');
    tab.title=sec.name;

    const dot=document.createElement('input');
    dot.type='color'; dot.className='sc-tab-dot'; dot.value=getSecColor(sec); dot.title='Pick colour';
    dot.addEventListener('click',e=>e.stopPropagation());
    dot.addEventListener('input',e=>{ sec.colorHex=e.target.value; renderScenarioBar(); refreshResultLabels(); });
    tab.appendChild(dot);

    const name=document.createElement('span');
    name.className='sc-tab-name'; name.textContent=sec.name||'Scenario';
    tab.appendChild(name);

    const badge=document.createElement('span');
    badge.className='sc-tab-badge'; badge.innerHTML=sec.type==='ticker'?SVG_TICKER:SVG_CUSTOM;
    tab.appendChild(badge);

    // Optimise runs the scenario on screen alone, so the bar stands down until Cancel.
    tab.addEventListener('click',()=>{ if(optVars.length) return; if(sec.id!==activeSecurityId){ activeSecurityId=sec.id; renderScenarioBar(); renderScenarioConfig(); } });
    tab.addEventListener('dblclick',()=>startRenameScenario(tab, sec));
    el.appendChild(tab);
  });
  // Keep the + Add button directly beside the last scenario so it flows with the tabs.
  if(addBtn) el.appendChild(addBtn);
  updateSimBtnState();
}

function startRenameScenario(tab, sec){
  const nameSpan=tab.querySelector('.sc-tab-name'); if(!nameSpan) return;
  const input=document.createElement('input');
  input.type='text'; input.className='sc-tab-rename'; input.value=sec.name;
  input.setAttribute('data-no-stale',''); // a rename is a label, not an assumption
  input.addEventListener('click',e=>e.stopPropagation());
  input.addEventListener('dblclick',e=>e.stopPropagation());
  const commit=()=>{ sec.name=input.value.trim()||sec.name; renderScenarioBar(); renderScenarioConfig(); refreshResultLabels(); };
  input.addEventListener('blur',commit);
  input.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); commit(); } if(e.key==='Escape'){ renderScenarioBar(); } });
  nameSpan.replaceWith(input); input.focus(); input.select();
}

/* ─── CONFIGURE SCENARIO - editor bound to the active scenario ─── */
function renderScenarioConfig(){
  const wrap=$('scenarioConfig'); if(!wrap) return;
  const sec=getActiveSec();
  if(!sec){
    wrap.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:8px 0">No scenario yet, click + to add one.</div>';
    return;
  }
  const tks=loadedTickers();
  const sym=currentCurrencySymbol||'$';
  const fmtN=(v,neg)=>SharedFmt.formatThousands(v==null?0:v,{maxDecimals:2,allowNegative:!!neg});
  // Custom scenarios reference a simulated-asset pool entry; migrate older configs
  // / presets that carried inline return & std so they still show in the dropdown.
  if(sec.type==='custom'){
    if(!sec.simName) sec.simName=sec.name;
    ensureSimEntry(sec.simName, sec.returnPct, sec.stdPct);
  }
  const curVal = sec.type==='ticker' ? ('t:'+sec.ticker) : ('s:'+(sec.simName||sec.name));
  const assetSelectBody = (tks.length || simPool.length)
    ? `<select class="sel-input" id="cfgAssetSelect">${
        (tks.length?`<optgroup label="Tickers (real)">${tks.map(tk=>`<option value="t:${tk}" data-chip="${escapeHtml(tickerName(tk))}" ${curVal==='t:'+tk?'selected':''}>${tk}</option>`).join('')}</optgroup>`:'')
      }${
        (simPool.length?`<optgroup label="Simulated">${simPool.map(s=>`<option value="s:${escapeHtml(s.name)}" ${curVal==='s:'+s.name?'selected':''}>ƒ ${escapeHtml(s.name)}</option>`).join('')}</optgroup>`:'')
      }</select>`
    : `<div class="status-bar status-warn" style="display:block">No assets yet: load tickers or add a simulated asset in the 📥 Data tab first.</div>`;
  wrap.innerHTML=`
    <div class="add-sec-area" style="border-top:none;padding-top:0">
      <div class="add-sec-row" style="gap:6px;align-items:center">
        <input class="txt-input" id="cfgName" data-no-stale placeholder="Scenario name" value="${escapeHtml(sec.name)}" style="flex:1;min-width:0"/>
        <input type="color" id="cfgColor" data-no-stale value="${getSecColor(sec)}" title="Pick colour" style="width:34px;height:34px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--input-bg);padding:2px;flex-shrink:0"/>
      </div>

      <div class="field-group">
        <div class="group-title">Top-Ups</div>
        <div class="sec-row">
          <label>Amount per top-up ${optBtnHtml('amount','Amount per top-up')}</label>
          <div class="affix-wrap">
            <span class="prefix" id="cfgAmountPrefix">${escapeHtml(sym)}</span>
            <input class="affix-input money-input" id="cfgAmount" type="text" inputmode="numeric" data-min="0" data-max="100000000000" value="${fmtN(sec.amount)}"/>
          </div>
        </div>
        <div class="sec-row">
          <label>Yearly increase <span class="tip-icon" data-tip="Grows the invested amount once a year and compounds: 10 makes year 2 +10% and year 3 +21%. 0 keeps it flat.">?</span> ${optBtnHtml('yearlyIncrease','Yearly increase')}</label>
          <div class="affix-wrap">
            <input class="affix-input money-input has-suffix" id="cfgYearlyInc" type="text" inputmode="numeric" data-min="0" data-max="100" value="${fmtN(sec.yearlyIncrease||0)}"/>
            <span class="suffix">%/yr</span>
          </div>
        </div>
      </div>

      <div class="field-group">
        <div class="group-title">Asset</div>
        <div class="fg-body">${assetSelectBody}</div>
      </div>
      <div class="field-group">
        <div class="group-title">Investment Style</div>
        <div class="fg-body" id="styleBlock${sec.id}">${styleBlockInner(sec)}</div>
      </div>
    </div>`;

  $('cfgName').addEventListener('input',e=>{ sec.name=e.target.value; renderScenarioBar(); refreshResultLabels(); });
  $('cfgColor').addEventListener('input',e=>{ sec.colorHex=e.target.value; renderScenarioBar(); refreshResultLabels(); });
  const asel=$('cfgAssetSelect');
  // Searchable: type a ticker or any part of its full name (shown as the row's chip).
  if(asel && window.SharedDropdown) SharedDropdown.searchable(asel,{placeholder:'Search ticker or name…', minWidth:380});
  if(asel) asel.addEventListener('change',e=>{
    const v=e.target.value;
    if(v.startsWith('t:')){
      sec.type='ticker'; sec.ticker=v.slice(2);
    } else if(v.startsWith('s:')){
      const def=findSim(v.slice(2));
      sec.type='custom'; sec.simName=v.slice(2);
      if(def){ sec.returnPct=def.returnPct; sec.stdPct=def.stdPct; }
    }
    updateSimBtnState();
    updateTechToggleVisibility();
    scheduleRun();
  });
  wireMoneyField($('cfgAmount'),{maxDecimals:2},v=>{ sec.amount=Math.max(0,v); scheduleRun(); });
  wireMoneyField($('cfgYearlyInc'),{maxDecimals:2},v=>{ sec.yearlyIncrease=Math.max(0,v); scheduleRun(); });
  wireStyleBlock(sec);
  syncOptUi();
}

function renderStyleOpt(sec,s){
  return `<label class="radio-opt${sec.style===s?' selected':''}" id="secStyleOpt${sec.id}_${s.replace(/-/g,'_')}">
    <input type="radio" name="secStyle${sec.id}" value="${s}" ${sec.style===s?'checked':''}/>
    <div class="radio-opt-text"><strong>${styleLabel(s)}</strong>${styleDesc(s)}</div>
  </label>`;
}

function wireDayInput(sec){
  const el=$(`secDay${sec.id}`); if(!el) return;
  ['input','change'].forEach(ev=>el.addEventListener(ev,e=>{ sec.dayOrDate=parseInt(e.target.value)||1; scheduleRun(); }));
}

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
// active category's options - plus the parameters for the currently selected
// style - are shown at any time.
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
    ? `<div class="param-note warn-note">⚠️ For demonstration only: these use prices within the period to pick the buy date and require future knowledge that cannot be replicated in real life.</div>`
    : '';
  // Show parameters only when the selected style belongs to the open category.
  const params = (styleCategory(sec.style)===active) ? renderStyleParams(sec) : '';
  return `
    <div class="cat-pills">${pills}</div>
    ${warn}
    <div class="radio-group" style="margin-top:8px">${opts}</div>
    <div class="style-params" id="styleParams${sec.id}">${params}</div>`;
}

// Monthly / Weekly segmented control - shared by the momentum + technical
// styles so each can invest once per chosen window (the date/forward styles
// carry their own cadence and don't show it).
function periodToggleRow(sec, id){
  const p = (sec.period==='weekly') ? 'weekly' : 'monthly';
  const word = p==='weekly' ? 'week' : 'month';
  return `<div class="param-row"><label>Frequency <span class="tip-icon" data-tip="One purchase per ${word} at most, on the first day the trigger fires. A ${word} it never fires in is skipped, unless 'Invest at End of ${word.charAt(0).toUpperCase()+word.slice(1)}' is ticked below.">?</span> ${optBtnHtml('period','Frequency')}</label>
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
  // A gauge (optimise mode) beside each setting that can be swept; the check
  // box keeps its label to itself, so its gauge sits after it, not inside it.
  const g=(key,label)=>optBtnHtml(key,label);
  const eomRow = `<div class="eom-row"><label class="tech-eom"><input type="checkbox" id="secTechEOM${id}" ${eomChecked?'checked':''}/> Invest at End of ${periodWord} if target not reached</label>${g('eom','End-of-period buy')}</div>`;
  // A look-back length, in trading days, with its unit inside the field.
  const days=(elId,min,max,val)=>`<div class="affix-wrap unit-days"><input class="affix-input has-suffix" id="${elId}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" value="${val}"/><span class="suffix">days</span></div>`;
  const maTypeSel=(elId,val)=>`<select class="sel-input" id="${elId}">
      <option value="sma" ${val==='sma'?'selected':''}>SMA</option>
      <option value="ema" ${val==='ema'?'selected':''}>EMA</option></select>`;
  if(s==='monthly-date')
    return `<div class="param-row"><label>Day of month ${g('dayOfMonth','Day of month')}</label><input class="num-input" id="secDay${id}" type="number" min="1" max="31" step="1" value="${Math.min(31,Math.max(1,sec.dayOrDate||1))}"/></div>`;
  if(s==='weekly-day')
    return `<div class="param-row"><label>Day of week ${g('weekday','Day of week')}</label><select class="sel-input" id="secDay${id}" style="max-width:160px">${WEEKDAY_OPTIONS.map((d,i)=>`<option value="${i+1}" ${Math.min(7,Math.max(1,sec.dayOrDate))===i+1?'selected':''}>${d}</option>`).join('')}</select></div>`;
  if(MOMENTUM_STYLES.includes(s))
    return `<div class="mom-row">
        <div class="slider-head" style="margin-bottom:4px">
          <span class="mom-label">Threshold ${g('momentumPct', s==='momentum-peak'?'Rise threshold':'Dip threshold')}</span>
          <span id="secMomPctVal${id}" class="slider-value">${(+sec.momentumPct).toFixed(1)}%</span>
        </div>
        <input type="range" id="secMomPct${id}" data-readout="secMomPctVal${id}" min="0.1" max="50" step="0.1" value="${sec.momentumPct}" style="width:100%;accent-color:var(--accent);cursor:pointer"/>
      </div>${eomRow}`;
  if(s==='tech-ma-cross')
    return `<div class="param-row"><label>Fast MA</label><div class="param-grp">${maTypeSel(`secMaFastType${id}`,t.fastMaType)}${g('tech.fastMaType','Fast MA type')}${days(`secMaFastLen${id}`,1,400,t.fastMaLen)}${g('tech.fastMaLen','Fast MA length')}</div></div>
      <div class="param-row"><label>Slow MA</label><div class="param-grp">${maTypeSel(`secMaSlowType${id}`,t.slowMaType)}${g('tech.slowMaType','Slow MA type')}${days(`secMaSlowLen${id}`,1,400,t.slowMaLen)}${g('tech.slowMaLen','Slow MA length')}</div></div>
      <div class="param-note">Buys on a golden cross, the Fast MA crossing above the Slow MA.</div>${eomRow}`;
  if(s==='tech-rsi')
    return `<div class="param-row"><label>RSI period ${g('tech.rsiPeriod','RSI period')}</label>${days(`secRsiPeriod${id}`,2,100,t.rsiPeriod)}</div>
      <div class="param-row"><label>Oversold &lt; ${g('tech.rsiOversold','Oversold level')}</label><input class="num-input" id="secRsiOversold${id}" type="number" min="1" max="99" step="1" value="${t.rsiOversold}"/></div>
      <div class="param-note">Buys when RSI falls below the oversold threshold.</div>${eomRow}`;
  if(s==='tech-bollinger')
    return `<div class="param-row"><label>MA period ${g('tech.bbPeriod','Bollinger MA period')}</label>${days(`secBbPeriod${id}`,2,200,t.bbPeriod)}</div>
      <div class="param-row"><label>Deviations ${g('tech.bbStd','Bollinger deviations')}</label><div class="affix-wrap unit-x"><input class="affix-input has-suffix" id="secBbStd${id}" type="number" inputmode="decimal" min="0.5" max="5" step="0.1" value="${t.bbStd}"/><span class="suffix">×</span></div></div>
      <div class="param-row"><label>Trigger ${g('tech.bbTrigger','Bollinger trigger')}</label><select class="sel-input" id="secBbTrigger${id}" style="max-width:220px"><option value="below" ${t.bbTrigger==='below'?'selected':''}>Close below lower band</option><option value="reclaim" ${t.bbTrigger==='reclaim'?'selected':''}>Reclaim above lower band</option></select></div>
      <div class="param-note">Bollinger Band = MA ± N standard deviations.</div>${eomRow}`;
  const macdRows=()=>`<div class="param-row"><label>Fast EMA ${g('tech.macdFast','MACD fast EMA')}</label>${days(`secMacdFast${id}`,1,100,t.macdFast)}</div>
      <div class="param-row"><label>Slow EMA ${g('tech.macdSlow','MACD slow EMA')}</label>${days(`secMacdSlow${id}`,1,200,t.macdSlow)}</div>
      <div class="param-row"><label>Signal EMA ${g('tech.macdSignal','MACD signal EMA')}</label>${days(`secMacdSignal${id}`,1,100,t.macdSignal)}</div>`;
  if(s==='tech-macd-cross')
    return `${macdRows()}
      <div class="param-note">Buys when the MACD line crosses above the signal line.</div>${eomRow}`;
  if(s==='tech-macd-hist')
    return `${macdRows()}
      <div class="param-row"><label>Hist &gt; ${g('tech.macdHistThreshold','Histogram threshold')}</label><input class="num-input" id="secMacdHist${id}" type="number" step="0.1" value="${t.macdHistThreshold}"/></div>
      <div class="param-note">Buys when the histogram turns positive after being negative.</div>${eomRow}`;
  if(s==='tech-adx')
    return `<div class="param-row"><label>ADX period ${g('tech.adxPeriod','ADX period')}</label>${days(`secAdxPeriod${id}`,2,100,t.adxPeriod)}</div>
      <div class="param-row"><label>Trend &gt; ${g('tech.adxThreshold','ADX threshold')}</label><input class="num-input" id="secAdxThreshold${id}" type="number" min="1" max="100" step="1" value="${t.adxThreshold}"/></div>
      <div class="param-note">Buys only when ADX shows a strong trend (close-based ADX).</div>${eomRow}`;
  return ''; // forward-looking styles have no parameters
}

/* How often a scenario's style buys: the date and forward styles by their
   name, momentum and technical ones at most once per their Frequency. The
   amount is per purchase, so moving between the two cadences rescales it
   (SharedFreq): 500 a month is 115.38 a week, the same money over a year. */
function purchaseCadence(sec){
  const s=sec.style||'';
  if(MOMENTUM_STYLES.includes(s)||TECH_STYLES.includes(s)) return sec.period==='weekly'?'weekly':'monthly';
  return s.startsWith('weekly')?'weekly':'monthly';
}
function rescaleAmount(sec, from, to){
  const conv=(from===to)?null:SharedFreq.convert(sec.amount, from, to, 2);
  if(conv===null) return;
  sec.amount=conv;
  const amtEl=$('cfgAmount');
  if(amtEl) amtEl.value=SharedFmt.formatThousands(conv,{maxDecimals:2});
}

function refreshStyleBlock(sec){
  const c=$(`styleBlock${sec.id}`); if(!c) return;
  c.innerHTML=styleBlockInner(sec);
  wireStyleBlock(sec);
  // A new style brings its own settings: gauges for them, and a swept setting
  // the style no longer has is dropped.
  syncOptUi();
}

function wireStyleBlock(sec){
  const c=$(`styleBlock${sec.id}`); if(!c) return;
  // Category pills - switch which options are visible without changing selection.
  c.querySelectorAll('.cat-pill').forEach(p=>{
    p.addEventListener('click',()=>{ sec.catOpen=p.dataset.cat; refreshStyleBlock(sec); });
  });
  // Style radios
  c.querySelectorAll(`input[name="secStyle${sec.id}"]`).forEach(r=>{
    r.addEventListener('change',()=>{
      // A style that buys weekly rather than monthly (or back) makes the amount
      // per purchase a different amount a year, so it is rescaled as the
      // Frequency toggle below rescales it.
      const was=purchaseCadence(sec);
      sec.style=r.value;
      rescaleAmount(sec, was, purchaseCadence(sec));
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
    // Both ends named and the readout typeable, the way every finance slider is.
    if(window.SharedSlider) SharedSlider.enhance(momPctEl);
  }
  // Monthly / Weekly frequency toggle (momentum + technical). Re-render the
  // block on change so the EOM label and helper note pick up the new window.
  const periodSeg=$(`secPeriodSeg${sec.id}`);
  if(periodSeg) periodSeg.querySelectorAll('.seg-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      const next=b.dataset.period==='weekly'?'weekly':'monthly';
      const prev=sec.period==='weekly'?'weekly':'monthly';
      // The amount is per purchase, so a narrower window has to buy less for the
      // scenario to keep putting the same money in over a year.
      rescaleAmount(sec, prev, next);
      sec.period=next;
      refreshStyleBlock(sec);
      scheduleRun();
    });
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
    return; // Cache already covers the full requested range - no fetch needed
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
    // Fetch ONLY the segment(s) we don't already hold, then merge - never
    // re-download the whole history just to widen the range.
    const segments = [];
    if(!latestEntry){
      segments.push([requestedStart, requestedEnd]);
    } else {
      if(requestedStart < latestEntry.coverageStart) segments.push([requestedStart, latestEntry.coverageStart]);
      if(requestedEnd   > latestEntry.coverageEnd)   segments.push([SharedYF.tailStart(latestEntry), requestedEnd]);
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
    // returned no rows (e.g. a market holiday tail) - past prices are immutable.
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
// so the pool loader naturally refetches to refresh the tail - at most one
// request - while same-day reloads cost ZERO requests.
function persistPriceCache(){
  try { localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({savedAt: Date.now(), cache: priceCache})); }
  catch(_){ /* quota / private mode - caching is best-effort */ }
}
function loadPersistedCache(){
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && parsed.cache && typeof parsed.cache === 'object') priceCache = parsed.cache;
  } catch(_){ /* ignore corrupt cache */ }
}

/* ─── SIMULATED ASSET POOL ──────────────────────────────────────────────────────
   Custom (synthetic) assets are defined here, in the Data tab, alongside the real
   ticker pool. Each entry is {name, returnPct, stdPct}; scenarios then just pick
   one from a dropdown. Persisted (and shared with the Portfolio tool) so the pool
   survives reloads. */
const SIM_POOL_KEY = 'dca_simPool_v1';
let simPool = [];
let persist = null; // mini cache handle (assigned at init)
function persistSimPool(){ try { localStorage.setItem(SIM_POOL_KEY, JSON.stringify(simPool)); } catch(_){} if(persist) persist.schedule(); }
function loadPersistedSimPool(){
  try { const raw=localStorage.getItem(SIM_POOL_KEY); if(raw){ const a=JSON.parse(raw); if(Array.isArray(a)) simPool=a.filter(x=>x&&x.name); } } catch(_){}
}
function findSim(name){ return simPool.find(s=>s.name===name) || null; }
function addSimAsset(name, returnPct, stdPct){
  name=String(name||'').trim();
  if(!name) return {error:'Enter a name for the simulated asset.'};
  if(findSim(name)) return {error:'A simulated asset named "'+name+'" already exists.'};
  simPool.push({name, returnPct:Number(returnPct)||0, stdPct:Math.max(0,Number(stdPct)||0)});
  persistSimPool();
  return {ok:true};
}
function removeSimAsset(name){ simPool=simPool.filter(s=>s.name!==name); persistSimPool(); }
// Make sure a custom scenario references a pool entry (so older saved configs and
// presets that carried inline return/std still appear in the dropdown).
function ensureSimEntry(name, returnPct, stdPct){
  if(!name) return;
  if(!findSim(name)){ simPool.push({name, returnPct:Number(returnPct)||0, stdPct:Math.max(0,Number(stdPct)||0)}); persistSimPool(); }
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
  // A cached series dated on a different basis (see `basis` in the Worker) is
  // replaced, never merged: stitching the two would duplicate or shift days.
  const prev = (priceCache[tk] && priceCache[tk].basis === r.basis) ? priceCache[tk] : null;
  let dates = r.dates, prices = r.prices;
  // OHLC is carried through only when the Worker returns it (newer deployments).
  let opens = r.opens, highs = r.highs, lows = r.lows;
  const name = r.name || (priceCache[tk] && priceCache[tk].name) || '';
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
    source: r.source, kind: r.kind, basis: r.basis,
    // The security's full name (newer Worker deployments), kept across refreshes.
    ...(name ? {name} : {})
  };
  return true;
}
function minIso(a, b){ return (a && a < b) ? a : b; }
function maxIso(a, b){ return (a && a > b) ? a : b; }

// Once anything is cached, the load action is additive - relabel the button so
// users know subsequent loads add to (not replace) the pool.
function loadBtnLabel(){ return loadedTickers().length ? '⤓ Load additional tickers' : '⤓ Load tickers'; }
function updateLoadBtnLabel(){ const b=$('loadTickersBtn'); if(b && !b.disabled) b.innerHTML=loadBtnLabel(); }

// The filter shows once the pool holds more assets than this.
const POOL_FILTER_AT=8;
function renderPoolChips(){
  const box=$('poolChips'); if(!box) return;
  const tks=loadedTickers();
  const wrap=$('poolChipsWrap');
  if(!tks.length && !simPool.length){ box.innerHTML=''; if(wrap) wrap.style.display='none'; updateLoadBtnLabel(); return; }
  if(wrap) wrap.style.display='';
  // data-q is what the filter matches: the ticker and its full name.
  let html=tks.map(tk=>{
    const e=priceCache[tk];
    const warn=(e && e.kind==='stock' && e.source==='stooq');
    const nm=tickerName(tk);
    const range=(e && e.dates && e.dates.length)?e.dates[0]+' to '+e.dates[e.dates.length-1]:'';
    return `<li class="pool-row${warn?' pool-row-warn':''}"${warn?' title="Loaded from Stooq (unadjusted for splits/dividends)"':''} data-q="${escapeHtml((tk+' '+nm).toLowerCase())}"><span class="pool-tk">${tk}${warn?' ⚠️':''}</span><span class="pool-info"><span class="pool-nm">${escapeHtml(nm||tk)}</span><span class="pool-range">${range}</span></span>${SharedIcon.button('trash', 'Remove '+tk, 'sm pool-chip-del', `data-tk="${tk}"`)}</li>`;
  }).join('');
  html+=simPool.map(s=>{
    const nm=escapeHtml(s.name);
    return `<li class="pool-row pool-row-sim" data-q="${escapeHtml(('simulated '+s.name).toLowerCase())}"><span class="pool-tk">ƒ sim</span><span class="pool-info"><span class="pool-nm">${nm}</span><span class="pool-range">return ${s.returnPct}% · std ${s.stdPct}%</span></span>${SharedIcon.button('trash', 'Remove '+s.name, 'sm pool-chip-del', `data-sim="${nm}"`)}</li>`;
  }).join('');
  box.innerHTML=html;
  box.querySelectorAll('.pool-chip-del[data-tk]').forEach(b=>b.addEventListener('click', ()=>removeFromPool(b.dataset.tk)));
  box.querySelectorAll('.pool-chip-del[data-sim]').forEach(b=>b.addEventListener('click', ()=>{ removeSimAsset(b.dataset.sim); renderPoolChips(); refreshTickerSelect(); }));
  const n=tks.length+simPool.length;
  const cnt=$('poolCount'); if(cnt) cnt.textContent='('+n+')';
  const rb=$('refreshPoolBtn'); if(rb) rb.style.display=tks.length?'':'none';
  // Past a handful of rows the filter shows; the list itself scrolls (style.css).
  const f=$('poolFilter');
  if(f){ f.style.display=n>POOL_FILTER_AT?'':'none'; if(n<=POOL_FILTER_AT) f.value=''; }
  filterPoolChips();
  updateLoadBtnLabel();
}
// Show only the rows whose ticker or full name holds the filter's text.
function filterPoolChips(){
  const box=$('poolChips'); if(!box) return;
  const f=$('poolFilter');
  const q=(f && f.style.display!=='none' ? f.value : '').trim().toLowerCase();
  let shown=0;
  box.querySelectorAll('.pool-row').forEach(c=>{ const hit=!q || (c.dataset.q||'').includes(q); c.hidden=!hit; if(hit) shown++; });
  const empty=$('poolFilterEmpty'); if(empty) empty.hidden=!(q && !shown);
  box.style.display=(q && !shown)?'none':'';
}
// The full name a ticker goes by: the one Yahoo gave when it was loaded, else the
// reference list's (ticker/names.js). '' when neither knows it.
function tickerName(tk){
  const e=priceCache[tk];
  return (e && e.name) || (window.DCA_TICKER_NAMES && window.DCA_TICKER_NAMES[tk]) || '';
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
  markStale();   // a scenario may have been pointing at it
}

// Drop the entire cached pool (the data the app shows on first open lives here).
function clearPool(){
  if(!loadedTickers().length && !simPool.length) return;
  priceCache = {};
  persistPriceCache();
  simPool = [];
  persistSimPool();
  renderPoolChips();
  refreshTickerSelect();
  hideStatus($('poolStatus'));
  markStale();   // every scenario has lost the data behind it
  const inp=$('tickerPoolInput'); if(inp) inp.focus();
}

// Reflect a freshly-loaded pool in the active scenario's ticker dropdown.
function refreshTickerSelect(){
  if($('scenarioConfig')) renderScenarioConfig();
  updateSimBtnState();
}

// Loading is additive and individual tickers are removed with the chip's bin, so the
// input is never locked - it always stays open for adding the next batch.
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
// `only` (Refresh) is a list of loaded tickers to bring up to today instead.
async function loadTickerPool(only){
  const inp = $('tickerPoolInput');
  const list = only ? [...only] : [...new Set((inp.value||'').split(/[\s,;]+/).map(s=>s.trim().toUpperCase()).filter(Boolean))];
  if(!list.length){ showStatus($('poolStatus'), only ? 'No tickers are loaded yet.' : 'Enter at least one ticker.','error'); return; }
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
      const ts = SharedYF.tailStart(e);                    // overlaps the cache, see shared.js
      if(ts < tailStart) tailStart = ts;
    } else {
      fullNeed.push(t);                                   // no cache (or a front gap) → full history
    }
  }
  const need = fullNeed.length + tailNeed.length;
  if(!need){
    showStatus($('poolStatus'), only ? 'Every loaded ticker is already up to date.' : 'All requested tickers are already cached.','ok');
    if(inp && !only) inp.value=''; renderPoolChips(); refreshTickerSelect(); updateRateInfo();
    return;
  }

  // Soft daily cap - refuse early with a clear message instead of burning a wasted call.
  const reqsNeeded = (fullNeed.length?1:0) + (tailNeed.length?1:0);
  const remaining = SharedYF.getDailyRemaining();
  if(remaining <= 0){
    showStatus($('poolStatus'),'Daily limit reached: you\'ve used all '+SharedYF.getDailyLimit()+' data requests for today. They reset tomorrow; cached tickers still work.','error');
    updateRateInfo();
    return;
  }

  const loadBtn = $('loadTickersBtn'), refreshBtn = $('refreshPoolBtn');
  loadBtn.disabled = true; loadBtn.innerHTML = '<span class="spinner"></span>Loading…';
  if(refreshBtn) refreshBtn.disabled = true;
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
    // Tail extensions first - they're cheap and refresh existing data.
    if(tailNeed.length){
      const map = await SharedYF.fetchPricesBatch(tailNeed, tailStart, fetchEnd);
      absorb(tailNeed, tailStart, map);
      // A tail dated on a new basis replaces the cached history (storeBatchResult),
      // so that ticker needs its full history again.
      for(const t of tailNeed){ const e=priceCache[t]; if(e && e.coverageStart > POOL_FETCH_START && !fullNeed.includes(t)){ fullNeed.push(t); ok--; } }
    }
    if(fullNeed.length){
      const map = await SharedYF.fetchPricesBatch(fullNeed, POOL_FETCH_START, fetchEnd);
      absorb(fullNeed, POOL_FETCH_START, map);
    }
    persistPriceCache();
    if(failed.length && ok) showStatus($('poolStatus'), ok+' loaded · could not load: '+failed.join(', '),'warn');
    else if(failed.length) showStatus($('poolStatus'),'Could not load: '+failed.join(', '),'error');
    else showStatus($('poolStatus'), ok+(only ? ' ticker(s) refreshed to the latest close.' : ' ticker(s) loaded and cached.'),'ok');
    if(ok && !failed.length && inp && !only) inp.value='';
    renderPoolChips();
    refreshTickerSelect();
    if(ok) markStale();   // fresh history behind a scenario is a different run
  } catch(e){
    showStatus($('poolStatus'),'Load failed: '+e.message,'error');
  } finally {
    loadBtn.disabled = false; loadBtn.innerHTML = loadBtnLabel();
    if(refreshBtn) refreshBtn.disabled = false;
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

/* ─── SCENARIO BAR ACTIONS (add / copy / delete) ─── */
// A new scenario defaults to a ticker (the loaded pool) when available, else a
// custom simulated asset, matching the "ticker first" preference in the editor.
$('addScenarioBtn').addEventListener('click', ()=>{
  if(optVars.length) return;
  const tks = loadedTickers();
  const n = securities.length + 1;
  // A scenario references one asset from the shared pool (loaded tickers or simulated
  // assets, defined in the Data tab). Default a new scenario to the first available
  // pool asset rather than minting a throwaway custom one.
  if(tks.length) addSecurity({type:'ticker', ticker:tks[0], name:'Scenario '+n});
  else if(simPool.length){ const s=simPool[0]; addSecurity({type:'custom', simName:s.name, returnPct:s.returnPct, stdPct:s.stdPct, name:'Scenario '+n}); }
  else addSecurity({type:'custom', name:'Scenario '+n});
  scheduleRun();
});
$('dupScenarioBtn').addEventListener('click', ()=>{ if(activeSecurityId!=null && !optVars.length){ duplicateSecurity(activeSecurityId); scheduleRun(); } });
$('delScenarioBtn').addEventListener('click', ()=>{ if(activeSecurityId!=null && !optVars.length){ removeSecurity(activeSecurityId); scheduleRun(); } });

/* ─── TICKER POOL WIRING ─── */
$('loadTickersBtn').addEventListener('click', ()=>loadTickerPool());
{ const rb=$('refreshPoolBtn'); if(rb) rb.addEventListener('click', ()=>loadTickerPool(loadedTickers())); }
{ const pf=$('poolFilter'); if(pf) pf.addEventListener('input', filterPoolChips); }
// The Loaded assets list stays folded until asked for: most visits never need it.
{ const pt=$('poolToggle'), pb=$('poolBody'); if(pt && pb) pt.addEventListener('click', ()=>{ const open=pb.hidden; pb.hidden=!open; pt.setAttribute('aria-expanded', String(open)); }); }
$('editTickersBtn').addEventListener('click', ()=>{ setPoolLocked(false); const i=$('tickerPoolInput'); if(i) i.focus(); });
{ const cb=$('clearPoolBtn'); if(cb) cb.addEventListener('click', clearPool); }
$('tickerPoolInput').addEventListener('keydown', e=>{
  // Enter loads; Shift+Enter inserts a newline.
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); loadTickerPool(); }
});

/* ─── DATA MODE TOGGLE (Real ↔ Simulated) ─── */
let dataMode='real';
function setDataMode(mode){
  dataMode = mode==='simulated' ? 'simulated' : 'real';
  document.querySelectorAll('#dataModeToggle .seg-btn').forEach(b=>b.classList.toggle('active', b.dataset.dmode===dataMode));
  const real=$('dataRealPanel'), sim=$('dataSimPanel');
  if(real) real.style.display = dataMode==='real' ? '' : 'none';
  if(sim) sim.style.display = dataMode==='simulated' ? '' : 'none';
  updateBtnRow();
}
document.querySelectorAll('#dataModeToggle .seg-btn').forEach(b=>{
  b.addEventListener('click', ()=>setDataMode(b.dataset.dmode));
});
{ const addSim=$('addSimBtn'); if(addSim) addSim.addEventListener('click', ()=>{
  const name=$('simNameInput').value;
  const ret=parseFloat($('simReturnInput').value);
  const std=parseFloat($('simStdInput').value);
  const r=addSimAsset(name, Number.isFinite(ret)?ret:0, Number.isFinite(std)?std:0);
  if(r.error){ showStatus($('simStatus'), r.error, 'error'); return; }
  showStatus($('simStatus'), 'Simulated asset "'+name.trim()+'" added.', 'ok');
  $('simNameInput').value='';
  renderPoolChips();
  refreshTickerSelect();
}); }

/* ─── CURRENCY CHANGE ─── */
$('currencySymbol').addEventListener('change',e=>{
  currentCurrencySymbol=e.target.value;
  const pfx=$('cfgAmountPrefix'); if(pfx) pfx.textContent=currentCurrencySymbol||'$';
  if(simResults.length){ updateTables(); updateEquityChart(); updatePriceChart(); }
  if(optResult){ updateOptChart(); renderOptPickers(); }
  syncOptUi();   // the gate's note names money in the new symbol
});
$('randomSeed').addEventListener('input',e=>{
  currentRandomSeed = sanitizeSeed(e.target.value);
  scheduleRun();
});
$('execTiming').addEventListener('change',e=>{
  currentExecTiming = SharedTA.EXEC_MODES.includes(e.target.value) ? e.target.value : DEFAULT_EXEC_TIMING;
  scheduleRun();
});
$('riskFreeRate').addEventListener('input',e=>{
  const n=parseFloat(e.target.value);
  currentRiskFreeRate = Number.isFinite(n) ? Math.max(0,n) : 0;
  // Only the advanced metrics depend on this - re-render the summary in place.
  // A sweep keeps only each run's figures, its Sharpe and Sortino taken at the
  // old rate, so ranking by the new one takes a fresh run.
  if(optResult) markStale();
  else if(simResults.length) renderSummary();
  renderAssumptions();
});

/* ─── DEFAULT DATE RANGE ─── */
(function initDates(){
  const end=new Date();
  const start=new Date(); start.setFullYear(start.getFullYear()-5);
  $('startDate').value=isoDate(start);
  $('endDate').value=isoDate(end);
})();

/* ─── TECHNICAL INDICATORS ─── */
// Indicators + the technical buy-signal builder + period bucketing live in
// shared.js (SharedTA) so the portfolio tool reuses the exact same logic. They
// operate on a close-price series only and are computed lazily. Bound to local
// names here so the rest of this file reads unchanged.
const smaSeries        = SharedTA.smaSeries;
const emaSeries        = SharedTA.emaSeries;
const maSeries         = SharedTA.maSeries;
const rsiSeries        = SharedTA.rsiSeries;
const bollingerSeries  = SharedTA.bollingerSeries;
const macdSeries       = SharedTA.macdSeries;
const adxSeries        = SharedTA.adxSeries;
const buildTech        = SharedTA.buildTech;
const isoWeekBucket    = SharedTA.isoWeekBucket;
const periodKey        = SharedTA.periodKey;
// Group trading-day indices into chronological per-period buckets (dates arrive
// sorted, so insertion order == chronological order).
function groupIndicesByPeriod(dates, period){
  const groups={};
  dates.forEach((d,i)=>{ const k=periodKey(d,period); (groups[k]||(groups[k]=[])).push(i); });
  return Object.values(groups);
}

// Pick one buy per period (month or week): the first day the signal fires, or - 
// when "Invest at End of …" is on - the last trading day if it never fired.
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
    // The move is measured exactly as the Portfolio tool's Price % move trigger
    // measures it (price / open - 1 against the threshold), so a price sitting on
    // the threshold fires in both or in neither; p >= open*(1+t) rounds differently.
    const threshold=(momentumPct||5)/100;
    groupIndicesByPeriod(dates, period).forEach(idxs=>{
      const refPrice=prices[idxs[0]];
      let invested=false;
      for(const i of idxs){
        if(!(refPrice>0) || !(Number.isFinite(prices[i]) && prices[i]>0)) continue;
        const move=prices[i]/refPrice-1;
        if(style==='momentum-peak' ? move>=threshold : move<=-threshold){
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

// `exec` (Settings: Trade at) moves each fill off the day the rule decides on:
// the decision is always taken at that day's close, the order fills at that
// close, the next day's open or the next day's close (SharedTA.execPlan). The
// money is deposited on the day it buys, at the price it buys at. A decision on
// the last day with a next-day fill has no next day, so it never fills.
function simulateSecurity(sec, exec){
  const {dates, prices} = sec.priceData;
  const investIdxs = getInvestmentDates(sec.priceData, sec.style, sec.dayOrDate, sec.momentumPct, sec.momentumEOM, sec.tech, sec.techEOM, sec.period||'monthly');
  const plan = SharedTA.execPlan(prices, sec.priceData.opens, exec);
  const decidedOn = new Map();                       // fill day -> decision day
  investIdxs.forEach(i=>{ if(i+plan.lag<dates.length) decidedOn.set(i+plan.lag, i); });
  const startStr = dates[0];
  const yinc = sec.yearlyIncrease||0;

  // A missing, zero or negative price is bad data, not a tradable day. Without
  // this guard one such tick buys Infinity units and every downstream number
  // (equity, ROI, metrics) becomes Infinity/NaN.
  const ok=v=>Number.isFinite(v) && v>0;
  const tradable=i=>ok(prices[i]);

  let totalUnits=0, totalDeposited=0, openProxied=0;
  const investRows=[], dailyRows=[];
  for(let i=0;i<dates.length;i++){
    if(decidedOn.has(i) && ok(plan.fill[i])){
      const price=plan.fill[i];
      const amt=investAmountAt(sec.amount, yinc, startStr, dates[i]);
      const units=amt/price;
      totalUnits+=units;
      totalDeposited+=amt;
      if(plan.proxy[i]) openProxied++;
      investRows.push({
        date:dates[i], signalDate:dates[decidedOn.get(i)], price, amountInvested:amt, unitsAdded:units,
        totalUnits, totalDeposited, equity:totalUnits*price,
        // Nothing deposited yet (e.g. a contribution of 0) means no return to
        // report, not 0/0.
        returnPct: totalDeposited>0 ? (totalUnits*price-totalDeposited)/totalDeposited*100 : 0
      });
    }
    // The day closes at its closing price, whatever the fill was.
    dailyRows.push({
      date:dates[i], price:prices[i],
      totalUnits, totalDeposited,
      equity:totalUnits*(tradable(i)?prices[i]:0)
    });
  }

  // Value the final holding at the closing price, or at nothing if that price is
  // unusable - never at the old `||1` fallback, which reported the unit count as
  // dollars.
  const endPx=tradable(dates.length-1)?prices[dates.length-1]:0;
  // Decisions on the last day(s) that a next-day fill never reached.
  const unfilled=investIdxs.filter(i=>i+plan.lag>=dates.length).length;
  return { investRows, dailyRows, finalEquity: totalUnits*endPx, totalDeposited, exec:plan.mode, openProxied, unfilled };
}

// Reduce price series to the dates present in all of them (OHLC carried along).
// Pure, so the audit harness can lift it off the page.
function alignToCommonDates(series){
  let common=series[0].dates.slice();
  for(let k=1;k<series.length;k++){ const have=new Set(series[k].dates); common=common.filter(d=>have.has(d)); }
  return series.map(pd=>{
    const at=new Map(pd.dates.map((d,i)=>[d,i]));
    const pick=arr=>common.map(d=>arr[at.get(d)]);
    const out={dates:common.slice(), prices:pick(pd.prices)};
    if(pd.opens && pd.highs && pd.lows){ out.opens=pick(pd.opens); out.highs=pick(pd.highs); out.lows=pick(pd.lows); }
    return out;
  });
}

/* ─── OPTIMISE: WHAT CAN BE SWEPT, AND HOW ─────────────────────────────────────
   Optimise mode runs ONE scenario many times, sweeping up to two of its
   settings over a range, so a reader can see how the result moves with them
   and where it peaks. It follows the Portfolio tool's rule: a setting qualifies
   only when changing it changes nothing else on the form, so every tested value
   is a plan the reader could have typed in, with no field quietly appearing,
   vanishing or being filled with a guess:

     - plain numbers: the amount per top-up and its yearly increase, the day of
       the month, a momentum threshold, and every number an indicator reads;
     - fixed lists: the weekday, the Monthly / Weekly frequency, the End of
       period buy, a moving average's type and the Bollinger trigger.

   The frequency carries one contained knock-on, the one the form applies when
   it is switched by hand: the amount per purchase follows it, so each year's
   money stays the same.

   Left out on purpose: the asset and the investment style (each swaps the
   fields around it), Trade at, the seed, the dates, and the risk-free rate,
   which only feeds Sharpe and Sortino and moves no money.

   Every spec is built from the scenario as it stands, so `optSpec` returning
   null means "not sweepable here" (a day of the month under a weekly style, an
   RSI number under a moving-average one), and a swept setting that stops
   qualifying is dropped (pruneOptVars). */
const OPT_MAX_VARS = 2;
const OPT_MAX_STEPS = 50;      // values per swept setting
const OPT_MAX_RUNS = 625;      // runs per optimisation, 25 x 25 at the most
const OPT_ICON = '<svg class="tico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.3 18.4a8 8 0 1 1 11.4 0"/><path d="M12 13.4 8.6 9.3"/><circle cx="12" cy="13.6" r="1.35"/></svg>';
const OPT_FREQS = [{v:'monthly', l:'Monthly'}, {v:'weekly', l:'Weekly'}];
// The settings an indicator style reads, keyed as in sec.tech, with the styles
// that show each one and the bounds its field carries.
const OPT_MA_TYPES = [{v:'sma', l:'SMA'}, {v:'ema', l:'EMA'}];
const OPT_TECH = {
  fastMaType:  {label:'Fast MA type',         styles:['tech-ma-cross'], list:OPT_MA_TYPES},
  fastMaLen:   {label:'Fast MA length',       styles:['tech-ma-cross'], min:1,   max:400, int:true, unit:'days'},
  slowMaType:  {label:'Slow MA type',         styles:['tech-ma-cross'], list:OPT_MA_TYPES},
  slowMaLen:   {label:'Slow MA length',       styles:['tech-ma-cross'], min:1,   max:400, int:true, unit:'days'},
  rsiPeriod:   {label:'RSI period',           styles:['tech-rsi'],      min:2,   max:100, int:true, unit:'days'},
  rsiOversold: {label:'Oversold level',       styles:['tech-rsi'],      min:1,   max:99,  int:true, unit:'', spread:15},
  bbPeriod:    {label:'Bollinger MA period',  styles:['tech-bollinger'], min:2,  max:200, int:true, unit:'days'},
  bbStd:       {label:'Bollinger deviations', styles:['tech-bollinger'], min:0.5, max:5,  dp:1, unit:'×', spread:1},
  bbTrigger:   {label:'Bollinger trigger',    styles:['tech-bollinger'], list:[{v:'below', l:'Close below lower band'}, {v:'reclaim', l:'Reclaim above lower band'}]},
  macdFast:    {label:'MACD fast EMA',        styles:['tech-macd-cross','tech-macd-hist'], min:1, max:100, int:true, unit:'days'},
  macdSlow:    {label:'MACD slow EMA',        styles:['tech-macd-cross','tech-macd-hist'], min:1, max:200, int:true, unit:'days'},
  macdSignal:  {label:'MACD signal EMA',      styles:['tech-macd-cross','tech-macd-hist'], min:1, max:100, int:true, unit:'days'},
  // The field takes any number, in the price's own units, so the sweep opens a
  // step either side of the value it holds.
  macdHistThreshold:{label:'Histogram threshold', styles:['tech-macd-hist'], min:-1000, max:1000, dp:2, unit:'',
    def:b=>({start:b-1, end:b+1, steps:11})},
  adxPeriod:   {label:'ADX period',           styles:['tech-adx'],      min:2,   max:100, int:true, unit:'days'},
  adxThreshold:{label:'ADX threshold',        styles:['tech-adx'],      min:1,   max:100, int:true, unit:'', spread:15}
};

function optClamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
function optRound(v, spec){ return spec.int ? Math.round(v) : +(+v).toFixed(spec.dp==null ? 2 : spec.dp); }
// A range around the value the field holds now: half to one and a half times it
// for a size, a fixed spread for a level, the field's own bounds either way.
function optAround(spec, base, steps){
  let a, b;
  if(spec.spread){ a=base-spec.spread; b=base+spec.spread; }
  else if(base>0){ a=base/2; b=base*1.5; if(spec.int && b-a<4){ a=base-2; b=base+2; } }
  else { a=spec.min; b=spec.min+10; }
  a=optRound(optClamp(a, spec.min, spec.max), spec); b=optRound(optClamp(b, spec.min, spec.max), spec);
  if(b<=a) b=optRound(optClamp(a+(spec.int?4:1), spec.min, spec.max), spec);
  return {start:a, end:b, steps: spec.int ? Math.min(steps||11, b-a+1) : (steps||11)};
}
// Money keeps its cents (a weekly amount the frequency rescaled is 115.38, not 115).
function optMoney(n){ return (n<0?'−':'')+(currentCurrencySymbol||'')+SharedFmt.formatThousands(String(Math.abs(n)), {maxDecimals:2}); }
function optFmtNum(spec, v){
  const n=Number(v);
  if(spec.unit==='money') return optMoney(n);
  const s=spec.int ? String(Math.round(n)) : String(+n.toFixed(spec.dp==null ? 2 : spec.dp));
  if(spec.unit==='%' || spec.unit==='%/yr') return s+'%';
  if(spec.unit==='days') return s+(Math.round(n)===1?' day':' days');
  if(spec.unit==='×') return s+'×';
  return s;
}

// The spec of one sweepable setting of scenario `sec`, or null when that setting
// is not sweepable on `sec` as it stands. A key names the setting:
//   amount, yearlyIncrease, dayOfMonth, weekday, momentumPct, period, eom,
//   tech.<f> for f an OPT_TECH key.
function optSpec(key, sec){
  if(!sec || typeof key!=='string') return null;
  const st=sec.style||'', isMom=MOMENTUM_STYLES.includes(st), isTech=TECH_STYLES.includes(st);
  const num=o=>Object.assign({key, kind:'num', dp:2, steps:11, fmt(v){ return optFmtNum(this, v); }}, o);
  const list=o=>Object.assign({key, kind:'list', fmt(v){ const x=this.options.find(q=>String(q.v)===String(v)); return x ? x.l : String(v); }}, o);
  switch(key){
    case 'amount': return num({label:'Amount per top-up', unit:'money', min:0, max:1e11,
      get:q=>Number(q.amount)||0, apply:(x,v)=>{ x.amount=v; }});
    case 'yearlyIncrease': return num({label:'Yearly increase', unit:'%/yr', min:0, max:100,
      get:q=>Number(q.yearlyIncrease)||0, apply:(x,v)=>{ x.yearlyIncrease=v; },
      def:b=>({start:0, end:Math.max(10, Math.ceil(b*2)), steps:11})});
    case 'dayOfMonth': if(st!=='monthly-date') return null;
      return num({label:'Day of month', unit:'', min:1, max:31, int:true,
        get:q=>optClamp(parseInt(q.dayOrDate,10)||1, 1, 31), apply:(x,v)=>{ x.dayOrDate=v; },
        def:()=>({start:1, end:28, steps:28})});
    case 'weekday': if(st!=='weekly-day') return null;
      // A weekend day buys on the nearest trading day, Friday, so the sweep
      // opens on the five trading days; the weekend stays one click away.
      return list({label:'Day of week', options:WEEKDAY_OPTIONS.map((l,i)=>({v:i+1, l})), defPick:[1,2,3,4,5],
        get:q=>optClamp(parseInt(q.dayOrDate,10)||1, 1, 7), apply:(x,v)=>{ x.dayOrDate=v; }});
    case 'momentumPct': if(!isMom) return null;
      return num({label:st==='momentum-peak' ? 'Rise threshold' : 'Dip threshold', unit:'%', min:0.1, max:50, dp:1,
        get:q=>parseFloat(q.momentumPct)||5, apply:(x,v)=>{ x.momentumPct=v; }});
    case 'period': if(!isMom && !isTech) return null;
      return list({label:'Frequency', options:OPT_FREQS, late:true,
        get:q=>q.period==='weekly' ? 'weekly' : 'monthly',
        // The amount is per purchase, so it follows the frequency as it does when
        // the toggle is switched by hand (rescaleAmount): each year's money stays.
        apply:(x,v)=>{
          const from=x.period==='weekly' ? 'weekly' : 'monthly';
          if(from!==v){ const c=SharedFreq.convert(x.amount, from, v, 2); if(c!==null) x.amount=c; }
          x.period=v;
        }});
    case 'eom': if(!isMom && !isTech) return null;
      return list({label:'End-of-period buy', options:[{v:'on', l:'On'}, {v:'off', l:'Off'}],
        get:q=>(isMom ? q.momentumEOM : q.techEOM) ? 'on' : 'off',
        // The check box sets both, so a variant does too.
        apply:(x,v)=>{ x.momentumEOM=x.techEOM=(v==='on'); }});
  }
  const m=/^tech\.(\w+)$/.exec(key);
  if(m){
    const f=m[1], meta=OPT_TECH[f];
    if(!meta || !meta.styles.includes(st)) return null;
    const get=q=>{ const t=q.tech||{}; return t[f]!=null ? t[f] : TECH_DEFAULTS[f]; };
    const apply=(x,v)=>{ x.tech=Object.assign({}, x.tech); x.tech[f]=v; };
    if(meta.list) return list({label:meta.label, options:meta.list, get, apply});
    return num({label:meta.label, unit:meta.unit, min:meta.min, max:meta.max, int:!!meta.int, dp:meta.dp==null?2:meta.dp,
      spread:meta.spread, def:meta.def, get, apply});
  }
  return null;
}
// The range a setting opens on the first time it is picked.
function optDefaultRange(spec, sec){
  if(spec.kind==='list'){
    const pick=(spec.defPick || spec.options.map(o=>o.v)).slice();
    return {start:pick[0], end:pick[pick.length-1], steps:pick.length, pick};
  }
  const base=Number(spec.get(sec))||0;
  const r=Object.assign({steps:11}, spec.def ? spec.def(base) : optAround(spec, base, spec.steps));
  r.start=optRound(optClamp(r.start, spec.min, spec.max), spec); r.end=optRound(optClamp(r.end, spec.min, spec.max), spec);
  return r;
}

// The values a swept setting takes, in order, as they are run: a list setting
// runs the options picked, in the list's order, a number runs `steps` evenly
// spaced values, each rounded to the precision its field takes (whole days for
// a look-back, tenths for a threshold), so every value that ran is one a reader
// could type, and never twice.
function optValues(spec, vr){
  if(!spec || !vr) return [];
  if(spec.kind==='list'){
    const vals=spec.options.map(o=>o.v);
    if(Array.isArray(vr.pick)){ const want=new Set(vr.pick.map(String)); return vals.filter(x=>want.has(String(x))); }
    let a=vals.findIndex(x=>String(x)===String(vr.start)), b=vals.findIndex(x=>String(x)===String(vr.end));
    if(a<0 || b<0) return [];
    if(a>b){ const t=a; a=b; b=t; }
    return vals.slice(a, b+1);
  }
  let a=Number(vr.start), b=Number(vr.end);
  if(!isFinite(a) || !isFinite(b)) return [];
  a=optClamp(a, spec.min, spec.max); b=optClamp(b, spec.min, spec.max);
  if(a>b){ const t=a; a=b; b=t; }
  const n=Math.max(2, Math.min(OPT_MAX_STEPS, Math.round(Number(vr.steps))||2));
  const out=[];
  for(let i=0;i<n;i++){
    const v=optRound(a+(b-a)*i/(n-1), spec);
    if(!out.length || out[out.length-1]!==v) out.push(v);
  }
  return out;
}
// One tested plan: a copy of the scenario with the swept values written in,
// exactly where the form would write them. Nothing live is touched, and the
// price series is shared, never copied. null when a setting no longer applies.
function optVariant(sec, vars, vals){
  const v=Object.assign({}, sec, {tech:Object.assign({}, sec.tech||{})});
  const late=[];
  for(let k=0;k<vars.length;k++){
    const s=optSpec(vars[k].key, sec);
    if(!s) return null;
    if(s.late) late.push([s, vals[k]]); else s.apply(v, vals[k]);
  }
  // The frequency goes last, so a swept amount is rescaled with it like a typed one.
  late.forEach(([s, val])=>s.apply(v, val));
  return v;
}
// The figures one run is read by: the summary tile's and the advanced metrics.
function optMetricsOf(res){
  const fin=res.finalEquity, dep=res.totalDeposited, net=fin-dep;
  const m=computeMetrics(res);
  return { final:fin, net, roi:dep>0 ? net/dep : 0, dep, trades:res.investRows.length,
           sharpe:m.sharpe, sortino:m.sortino, twr:m.cagrTwr, mwr:m.cagrMwr };
}

/* ─── OPTIMISE MODE: THE FORM ──────────────────────────────────────────────────
   A gauge beside every sweepable field opens the range editor. Picking one puts
   the page in optimise mode: only the scenario on screen runs, so the bar that
   switches scenarios stands down, ▶ Simulate becomes ▶ Optimise with Cancel
   beside it, and the note above the gate says what the next run will sweep. */
function optBtnHtml(key, label){
  return `<button type="button" class="opt-btn" data-opt="${escapeHtml(key)}" title="Add ${escapeHtml(label)} to optimisation" aria-label="Add ${escapeHtml(label)} to optimisation">${OPT_ICON}</button>`;
}
function optPlan(sec){
  const specs=optVars.map(v=>optSpec(v.key, sec));
  const values=optVars.map((v,k)=>optValues(specs[k], v));
  return { specs, values, runs:values.reduce((n,a)=>n*a.length, 1) };
}
// "250 to $750", "7 to 21 days": the unit said once, at the end. A list names
// the values it picked: "Monthly, Weekly", "Monday, Wednesday, Friday".
function optRangeText(spec, vals){
  if(!vals.length) return '';
  if(spec.kind==='list') return vals.length<=4 ? vals.map(v=>spec.fmt(v)).join(', ') : spec.fmt(vals[0])+', '+spec.fmt(vals[1])+' … '+spec.fmt(vals[vals.length-1]);
  const first=(spec.kind==='num' && spec.unit!=='money') ? optFmtNum(Object.assign({}, spec, {unit:''}), vals[0]) : spec.fmt(vals[0]);
  return first+' to '+spec.fmt(vals[vals.length-1]);
}
// A swept setting that no longer qualifies (its field went away with a style)
// is dropped, and so is any past the first two.
function pruneOptVars(){
  if(!optVars.length) return;
  const sec=getActiveSec();
  const keep=[];
  optVars.forEach(v=>{
    const s=optSpec(v.key, sec);
    if(keep.length>=OPT_MAX_VARS || !s || keep.some(k=>k.key===v.key) || (s.kind==='list' && !Array.isArray(v.pick) && !optValues(s, v).length)) return;
    keep.push(v);
  });
  if(keep.length!==optVars.length){ optVars=keep; optChanged(); }
}
function optRowOf(btn){ return btn.closest('.param-row, .sec-row, .mom-row, .eom-row'); }
// Everything the mode shows on the form, from optVars: the gauges, the swept
// rows, the locked scenario bar, the gate and its note.
function syncOptUi(){
  pruneOptVars();
  const sec=getActiveSec(), on=optVars.length>0;
  document.body.classList.toggle('is-optimise', on);
  // A row can hold two gauges (a moving average's type and length), so a row is
  // lit when any gauge in it is swept, decided once for all of them.
  const lit=new Set();
  document.querySelectorAll('.opt-btn').forEach(b=>{
    const key=b.dataset.opt, spec=optSpec(key, sec);
    const vr=optVars.find(v=>v.key===key);
    b.hidden=!spec;
    const full=!vr && optVars.length>=OPT_MAX_VARS;
    b.classList.toggle('on', !!vr);
    b.classList.toggle('is-full', full);
    const label=spec ? spec.label : '';
    b.title = vr ? `Optimising ${label}: ${optRangeText(spec, optValues(spec, vr))}. Click to change.`
            : full ? `Up to ${OPT_MAX_VARS} settings at once. Remove one to pick this.`
            : `Add ${label} to optimisation`;
    const row=optRowOf(b);
    if(row && vr && spec) lit.add(row);
  });
  document.querySelectorAll('.opt-on').forEach(r=>{ if(!lit.has(r)) r.classList.remove('opt-on'); });
  lit.forEach(r=>r.classList.add('opt-on'));
  const bar=document.querySelector('.sc-bar');
  if(bar){ bar.classList.toggle('is-locked', on); if(on) bar.title='Optimise runs one scenario. Cancel to switch, add or remove scenarios.'; else bar.removeAttribute('title'); }
  ['addScenarioBtn','dupScenarioBtn','delScenarioBtn'].forEach(id=>{ const e=$(id); if(e) e.disabled=on; });
  const sb=$('simBtn');
  if(sb){ sb.classList.toggle('is-opt', on); if(sb.dataset.running!=='1') sb.textContent=simBtnLabel(); }
  updateBtnRow();
  renderStaleNote();
  updateSimBtnState();
}
function simBtnLabel(){ return optVars.length ? '▶ Optimise' : '▶ Simulate'; }
const STALE_TEXT='Inputs changed. Press Simulate to run them.';
function renderStaleNote(){
  const el=$('staleNote'); if(!el) return;
  if(!optVars.length){ el.textContent=STALE_TEXT; return; }
  const sec=getActiveSec(); if(!sec) return;
  const plan=optPlan(sec), two=optVars.length>1;
  const parts=optVars.map((v,k)=>{
    const s=plan.specs[k]; if(!s) return '';
    const vals=plan.values[k];
    return '<b>'+escapeHtml(s.label)+'</b> '+escapeHtml(optRangeText(s, vals))+(two?' ('+vals.length+')':'');
  }).filter(Boolean);
  el.innerHTML=(stale ? '<span class="sn-stale">Inputs changed.</span> ' : '')+
    'Optimise <span data-no-abbr>'+escapeHtml(sec.name)+'</span>: '+parts.join(' × ')+', '+plan.runs+(plan.runs===1?' run.':' runs.');
}
// After any change to what is swept: save, and send an optimisation on the board
// (or one still running) out of date. A comparison on the board still answers
// the form, so it is left alone. Callers redraw the form with syncOptUi.
function optChanged(){
  if(optResult || runInFlight) markStale();
  if(persist) persist.schedule();
}

/* ── The range editor ── */
let optEditKey=null, optEditReturn=null;
function optUnitAffix(spec){
  const pre=spec.unit==='money' ? (currentCurrencySymbol||'') : '';
  const suf={'%':'%', '%/yr':'%/yr', days:'days', '×':'×'}[spec.unit]||'';
  return {pre, suf};
}
function optFieldText(spec, v){
  return SharedFmt.formatThousands(String(v), {maxDecimals:spec.int?0:(spec.dp==null?2:spec.dp), allowNegative:spec.min<0});
}
function openOptModal(key, from){
  const sec=getActiveSec(), spec=optSpec(key, sec);
  if(!sec || !spec) return;
  let vr=optVars.find(v=>v.key===key);
  if(!vr){
    if(optVars.length>=OPT_MAX_VARS) return;
    vr=Object.assign({key}, optDefaultRange(spec, sec));
    optVars.push(vr);
    syncOptUi(); optChanged();
  }
  optEditKey=key; optEditReturn=from||null;
  $('optModalTitle').textContent='Optimise '+spec.label;
  const listy=spec.kind==='list';
  $('optNumFields').hidden=listy;
  $('optListFields').hidden=!listy;
  if(listy){
    // An old Start..End range opens as the options it ran, picked.
    if(!Array.isArray(vr.pick)) vr.pick=optValues(spec, vr);
    const on=new Set(vr.pick.map(String)), sel=$('optPickSel');
    sel.innerHTML=spec.options.map((o,i)=>`<option value="${i}"${on.has(String(o.v))?' selected':''}>${escapeHtml(o.l)}</option>`).join('');
    sel.size=Math.min(spec.options.length, 7);
  } else {
    const u=optUnitAffix(spec);
    [['optStart','optStartPre','optStartSuf',vr.start],['optEnd','optEndPre','optEndSuf',vr.end]].forEach(([id,pre,suf,val])=>{
      const el=$(id);
      el.setAttribute('data-min', String(spec.min)); el.setAttribute('data-max', String(spec.max));
      if(spec.int) el.setAttribute('step','1'); else el.removeAttribute('step');
      el.classList.toggle('money-input', spec.unit==='money');
      el.classList.toggle('has-suffix', !!u.suf);
      if(u.suf) el.removeAttribute('data-unitless'); else el.setAttribute('data-unitless','');
      $(pre).textContent=u.pre; $(pre).hidden=!u.pre;
      $(suf).textContent=u.suf; $(suf).hidden=!u.suf;
      el.value=optFieldText(spec, val);
    });
    $('optSteps').value=String(vr.steps);
  }
  renderOptModalNote();
  const ov=$('optModal'); ov.hidden=false;
  document.body.classList.add('opt-modal-open');
  const first=listy ? $('optPickSel') : $('optStart');
  setTimeout(()=>{ try{ first.focus(); if(first.select) first.select(); }catch(_){} }, 0);
}
function closeOptModal(){
  const ov=$('optModal'); if(!ov || ov.hidden) return;
  ov.hidden=true; document.body.classList.remove('opt-modal-open');
  const back=optEditReturn; optEditKey=null; optEditReturn=null;
  // The editor's own button may have been redrawn while it was open.
  const again=back && document.contains(back) ? back : null;
  if(again) try{ again.focus(); }catch(_){}
}
// What the range comes to, under the fields: how many values run and which.
function renderOptModalNote(){
  const el=$('optPreview'); if(!el || !optEditKey) return;
  const sec=getActiveSec(), spec=optSpec(optEditKey, sec), vr=optVars.find(v=>v.key===optEditKey);
  if(!spec || !vr){ el.textContent=''; return; }
  $('optModalSub').innerHTML='<span data-no-abbr>'+escapeHtml(sec.name)+'</span>, now '+escapeHtml(spec.fmt(spec.get(sec)))+'.'+
    (spec.key==='period' ? optFreqDemo(sec) : '');
  const vals=optValues(spec, vr);
  let html;
  if(vals.length<2) html='<span class="bad">'+(spec.kind==='list' ? 'Pick at least two values.' : 'Start and End give one value. Widen the range.')+'</span>';
  else {
    const shown=vals.length<=8 ? vals.map(v=>spec.fmt(v)).join(', ') : vals.slice(0,3).map(v=>spec.fmt(v)).join(', ')+' … '+vals.slice(-2).map(v=>spec.fmt(v)).join(', ');
    html=vals.length+' values: '+escapeHtml(shown)+'.';
  }
  const plan=optPlan(sec);
  if(plan.runs>OPT_MAX_RUNS) html+=' <span class="bad">'+plan.runs+' runs in all, over the '+OPT_MAX_RUNS+' a run allows: lower the steps.</span>';
  el.innerHTML=html;
}
// The frequency rescales the amount per purchase so each year's money stays the
// same (see optSpec). Shown as the amounts themselves, from the current input.
function optFreqDemo(sec){
  const from=sec.period==='weekly' ? 'weekly' : 'monthly';
  const year=SharedFreq.convert(Number(sec.amount)||0, from, 'yearly', 2);
  if(year===null) return '';
  const word={weekly:'week', monthly:'month'};
  return ' Each frequency keeps '+escapeHtml(optMoney(year))+' a year:<ul class="opt-freq-demo">'+OPT_FREQS.map(o=>{
    const v=o.v===from ? Number(sec.amount)||0 : SharedFreq.convert(Number(sec.amount)||0, from, o.v, 2);
    return '<li'+(o.v===from?' class="is-now"':'')+'><span>'+escapeHtml(o.l)+'</span><span>'+escapeHtml(optMoney(v))+' per '+word[o.v]+'</span></li>';
  }).join('')+'</ul>';
}
function optModalEdited(){
  syncOptUi(); optChanged(); renderOptModalNote();
}
function optEditVar(){ return optVars.find(v=>v.key===optEditKey)||null; }
['optStart','optEnd'].forEach(id=>{
  const el=$(id); if(!el) return;
  el.addEventListener('input',()=>{
    const vr=optEditVar(), spec=vr&&optSpec(vr.key, getActiveSec()); if(!spec) return;
    if(spec.unit==='money') SharedFmt.liveFormat(el, {maxDecimals:2});
    const n=SharedFmt.parseFormatted(el.value);
    if(!isFinite(n) || el.value.trim()==='' || el.value.trim()==='-') return;
    vr[id==='optStart'?'start':'end']=optClamp(n, spec.min, spec.max);
    optModalEdited();
  });
  el.addEventListener('blur',()=>{
    const vr=optEditVar(), spec=vr&&optSpec(vr.key, getActiveSec()); if(!spec) return;
    el.value=optFieldText(spec, vr[id==='optStart'?'start':'end']);
  });
});
$('optSteps').addEventListener('input',e=>{
  const vr=optEditVar(); if(!vr) return;
  const n=parseInt(e.target.value,10); if(!isFinite(n)) return;
  vr.steps=optClamp(n, 2, OPT_MAX_STEPS);
  optModalEdited();
});
$('optPickSel').addEventListener('change',e=>{
  const vr=optEditVar(), spec=vr&&optSpec(vr.key, getActiveSec()); if(!spec || spec.kind!=='list') return;
  vr.pick=[...e.target.selectedOptions].map(o=>spec.options[+o.value]).filter(Boolean).map(o=>o.v);
  if(vr.pick.length){ vr.start=vr.pick[0]; vr.end=vr.pick[vr.pick.length-1]; }
  optModalEdited();
});
$('optRemoveBtn').addEventListener('click',()=>{
  const key=optEditKey;
  optVars=optVars.filter(v=>v.key!==key);
  closeOptModal();
  syncOptUi(); optChanged();
});
$('optDoneBtn').addEventListener('click', closeOptModal);
$('optCloseBtn').addEventListener('click', closeOptModal);
$('optModal').addEventListener('mousedown',e=>{ if(e.target===$('optModal')) closeOptModal(); });
document.addEventListener('keydown',e=>{
  if($('optModal').hidden) return;
  if(e.key==='Escape'){ e.preventDefault(); closeOptModal(); }
  else if(e.key==='Enter' && e.target && e.target.tagName==='INPUT'){ e.preventDefault(); e.target.blur(); closeOptModal(); }
});
// One listener for every gauge, the ones drawn later with their style included.
document.addEventListener('click',e=>{
  if(!e.target || !e.target.closest) return;
  const b=e.target.closest('.opt-btn');
  // A gauge inside a <label> is that label's first control, so a click on the
  // label's words would press it. Those labels hold no field of their own.
  if(!b){ const lab=e.target.closest('label'); if(lab && lab.querySelector('.opt-btn')) e.preventDefault(); return; }
  e.preventDefault(); e.stopPropagation();
  if(b.classList.contains('is-full') && !optVars.some(v=>v.key===b.dataset.opt)) return;
  openOptModal(b.dataset.opt, b);
}, true);
$('optCancelBtn').addEventListener('click',()=>{
  if($('simBtn').dataset.running==='1') optAbort=true;
  optVars=[];
  closeOptModal();
  syncOptUi(); optChanged();
});

/* ─── OPTIMISE MODE: THE RUN ───────────────────────────────────────────────────
   The scenario is copied once at the start, so an edit made while the runs are
   going cannot leak into the later ones, then every combination of the swept
   values runs on the copy through the very engine Simulate uses. Only the
   figures of each run are kept; the one the charts below show is run again on
   demand, which keeps a 625-run sweep light. */
async function runOptimisation(){
  if(persist) persist.schedule();
  hideWarning();
  const blocked=simBlockReason();
  if(blocked){ showWarning(blocked); return; }
  const startDate=$('startDate').value, endDate=$('endDate').value;
  const live=getActiveSec();
  const simBtn=$('simBtn'); simBtn.dataset.running='1'; simBtn.disabled=true; simBtn.classList.remove('is-disabled'); simBtn.removeAttribute('data-tip'); simBtn.innerHTML='<span class="spinner"></span>Optimising…';
  optAbort=false; editedInFlight=false; runInFlight=true;
  try{
    const prep=await prepareRun([live], startDate, endDate);
    if(!prep || optAbort) return;
    const S0=Object.assign({}, live, {tech:Object.assign({}, live.tech||{})});
    const vars=optVars.map(v=>Object.assign({}, v, Array.isArray(v.pick) ? {pick:v.pick.slice()} : {}));
    const exec=currentExecTiming;
    const specs=vars.map(v=>optSpec(v.key, S0)), values=vars.map((v,k)=>optValues(specs[k], v));
    // The reader's own settings, to measure every tested value against.
    const baseRes=simulateSecurity(S0, exec);
    const base=optMetricsOf(baseRes);
    const n0=values[0].length, n1=values[1] ? values[1].length : 1, total=n0*n1;
    const grid=new Array(total);
    let done=0, lastPaint=performance.now();
    for(let j=0;j<n1;j++) for(let i=0;i<n0;i++){
      if(optAbort) return;
      const vals=[values[0][i]].concat(values[1] ? [values[1][j]] : []);
      const v=optVariant(S0, vars, vals);
      let m=null;
      try { m=v ? optMetricsOf(simulateSecurity(v, exec)) : null; } catch(e){ console.error('Optimise run failed', e); }
      grid[i+j*n0]={i, j, m};
      done++;
      if(performance.now()-lastPaint>45){
        simBtn.innerHTML=`<span class="spinner"></span>Optimising ${done} of ${total}…`;
        await new Promise(r=>setTimeout(r, 0));
        lastPaint=performance.now();
      }
    }
    optResult={ sid:S0.id, name:S0.name, S0, vars, specs, values, grid, base, baseVals:specs.map(s=>s.get(S0)), exec };
    // The charts below open on the best run, or on the run a saved file pointed at.
    const want=optPickWanted; optPickWanted=null;
    const best=optBestIdx(optResult, optMetricKey());
    const fits=want && want.length===vars.length && want.every((x,k)=>Number.isInteger(x) && x>=0 && x<values[k].length) &&
      grid[want[0]+(want[1]||0)*n0].m;
    optPick = fits ? want.slice() : (best>=0 ? [best%n0, Math.floor(best/n0)].slice(0, vars.length) : vars.map(()=>0));
    const axis=prep.axis;
    const notes=[];
    if(baseRes.openProxied) notes.push(`${baseRes.openProxied} trade(s) at the previous close, no open price in the data`);
    if(baseRes.unfilled) notes.push(`${baseRes.unfilled} decision(s) on the last day not filled`);
    showStatus($('dateRangeStatus'),`Date range: ${axis[0]} → ${axis[axis.length-1]} (${axis.length} days). ${total} runs`+(notes.length?' at your setting: '+notes.join('. ')+'.':'.'), notes.length?'warn':'ok');
    hideStatus($('fetchStatus'));
    setBoardMode();
    renderOptPickers();
    updateOptChart();
    showOptDetail();
    markFresh();
    if(editedInFlight) markStale();
  } finally {
    runInFlight=false;
    if(optAbort) hideStatus($('fetchStatus'));   // Cancel stopped it part way
    simBtn.disabled=false; delete simBtn.dataset.running; updateSimBtn(); updateSimBtnState();
  }
}

/* ── Reading the sweep ── */
const OPT_METRICS = {
  roi:    {label:'ROI',         axis:'ROI (%)',              kind:'pct'},
  final:  {label:'Final value', axis:'Final value',          kind:'money'},
  net:    {label:'Net',         axis:'Net',                  kind:'money'},
  sharpe: {label:'Sharpe',      axis:'Sharpe (ratio)',       kind:'ratio'},
  sortino:{label:'Sortino',     axis:'Sortino (ratio)',      kind:'ratio'},
  twr:    {label:'CAGR (TWR)',  axis:'CAGR, TWR (%/yr)',     kind:'pct'},
  mwr:    {label:'CAGR (MWR)',  axis:'CAGR, MWR (%/yr)',     kind:'pct'}
};
function optMetricKey(){ const s=$('optMetric'); return s && OPT_METRICS[s.value] ? s.value : 'roi'; }
function optAxisTitle(k){ const m=OPT_METRICS[k]; return m.kind==='money' ? m.axis+symInBrackets() : m.axis; }
function optMetricFmt(k, v){
  if(v==null || !isFinite(v)) return ' - ';
  const kind=OPT_METRICS[k].kind;
  return kind==='pct' ? fmt.pct(v) : kind==='money' ? fmt.currency(v) : v.toFixed(2);
}
// What a chart plots for a figure: percentages as percent, the rest as they are.
function optPlotVal(k, v){ if(v==null || !isFinite(v)) return null; return OPT_METRICS[k].kind==='pct' ? v*100 : v; }
function optVal(R, idx, k){ const g=R.grid[idx]; return g && g.m && isFinite(g.m[k]) && g.m[k]!=null ? g.m[k] : null; }
// Runs within rounding of each other are a tie, and a tie goes to the first
// tested: a top-up amount scales ROI exactly, and its last digits should not
// crown one amount over another.
const optTol=x=>1e-9*Math.max(1, Math.abs(x));
function optExtremeIdx(R, k, sign){
  let top=null;
  R.grid.forEach((g,i)=>{ const v=optVal(R,i,k); if(v!=null && (top===null || sign*(v-top)>0)) top=v; });
  if(top===null) return -1;
  return R.grid.findIndex((g,i)=>{ const v=optVal(R,i,k); return v!=null && Math.abs(v-top)<=optTol(top); });
}
function optBestIdx(R, k){ return optExtremeIdx(R, k, 1); }
function optWorstIdx(R, k){ return optExtremeIdx(R, k, -1); }
function optValsAt(R, idx){ const n0=R.values[0].length; return [R.values[0][idx%n0]].concat(R.values[1] ? [R.values[1][Math.floor(idx/n0)]] : []); }
function optSettingText(R, vals){ return R.specs.map((s,k)=>s.label+' '+s.fmt(vals[k])).join(', '); }
function optIsBase(R, vals){ return R.specs.every((s,k)=>String(vals[k])===String(R.baseVals[k])); }

// The board shows the last thing that ran: a comparison of scenarios, or a sweep
// with one of its tested settings in full below it.
function setBoardMode(){
  const on=!!optResult;
  $('optCard').hidden=!on;
  $('summaryNote').textContent = on ? '(best, your setting and worst)' : '';
  $('equityNote').textContent = on ? '(one tested setting)' : '';
  $('detailNote').textContent = on ? '(one tested setting)' : '';
  $('detailSelect').style.display = on ? 'none' : '';
  if(!on){
    purgeSurface();
    if(optChart){ optChart.destroy(); optChart=null; }
    $('optLegend').innerHTML=''; $('optPickWrap').innerHTML='';
    $('optCanvasWrap').style.display=''; $('optSurface').style.display='none';
  }
}
function renderOptPickers(){
  const R=optResult, wrap=$('optPickWrap'); if(!R || !wrap) return;
  wrap.innerHTML=R.specs.map((s,k)=>`<label><span data-no-abbr>${escapeHtml(s.label)}</span><select class="sel-input pf-view-select" id="optPick${k}" title="Which tested value the charts below show">${
    R.values[k].map((v,i)=>`<option value="${i}">${escapeHtml(s.fmt(v))}</option>`).join('')}</select></label>`).join('');
  R.specs.forEach((_,k)=>{
    const sel=$('optPick'+k);
    sel.value=String(optPick[k]||0);
    sel.addEventListener('change',()=>{ optPick[k]=+sel.value||0; showOptDetail(); if(persist) persist.schedule(); });
  });
}
// A click on the chart picks that tested value (both, on the surface).
function optSetPick(idx){
  const R=optResult; if(!R) return;
  idx.forEach((v,k)=>{ if(Number.isInteger(v) && v>=0 && v<R.values[k].length){ optPick[k]=v; const sel=$('optPick'+k); if(sel) sel.value=String(v); } });
  showOptDetail();
  if(persist) persist.schedule();
}
// Run the picked combination again, in full, for the charts and the breakdown.
function showOptDetail(){
  const R=optResult; if(!R) return;
  const vals=R.specs.map((_,k)=>R.values[k][optPick[k]||0]);
  let v=optVariant(R.S0, R.vars, vals), what=optSettingText(R, vals);
  if(!v){ v=R.S0; what='your current setting'; }
  const res=simulateSecurity(v, R.exec);
  simResults=[{ sec:Object.assign({}, v, {name:R.name+' · '+what}), ...res }];
  activeDetailSec=0;
  updatePriceChart(); updateEquityChart(); updateTables();
}

/* ── The optimisation chart: a line for one swept setting, a surface for two ── */
const OPT_SURFACE_EXPORT_SIZE = { width:940, height:520 };
let optChart=null, surfaceDrawn=false, surfaceClickWired=false;
function purgeSurface(){ if(surfaceDrawn && window.Plotly){ try{ Plotly.purge('optSurface'); }catch(_){} } surfaceDrawn=false; surfaceClickWired=false; }
function optUnitBracket(s){
  if(s.unit==='money') return symInBrackets();
  return s.unit ? ' ('+s.unit+')' : '';
}
function updateOptChart(){
  const R=optResult; if(!R) return;
  const mk=optMetricKey(), meta=OPT_METRICS[mk];
  $('optTitle').textContent='Optimisation: '+meta.label;
  const two=R.specs.length===2;
  $('optCanvasWrap').style.display=two ? 'none' : '';
  $('optSurface').style.display=two ? '' : 'none';
  if(two){ if(optChart){ optChart.destroy(); optChart=null; } drawOptSurface(); return; }
  purgeSurface();
  const s=R.specs[0], vals=R.values[0], isNum=s.kind==='num';
  const grid=cssVar('--chart-grid'), muted=cssVar('--chart-text'), text=cssVar('--text');
  const color=getSecColor(R.S0), mark=cssVar('--muted')||'#94a3b8';
  const yAt=i=>optPlotVal(mk, optVal(R, i, mk));
  const best=optBestIdx(R, mk);
  const baseIdx=vals.findIndex(v=>String(v)===String(R.baseVals[0]));
  const pt=(i,y)=>isNum ? {x:vals[i], y} : y;
  const only=(i,y)=>isNum ? (i<0?[]:[{x:vals[i], y}]) : vals.map((_,k)=>k===i?y:null);
  const datasets=[
    {label:meta.label, data:vals.map((_,i)=>pt(i, yAt(i))), borderColor:color, backgroundColor:color+'22', borderWidth:2.4,
      pointRadius:vals.length>30?0:2.5, pointHoverRadius:5, tension:0, spanGaps:false, fill:false},
    {label:'Best', data:best>=0 ? only(best, yAt(best)) : [], showLine:false, pointStyle:'circle', pointRadius:7, pointHoverRadius:7,
      borderColor:text, backgroundColor:'transparent', borderWidth:2, _opt:'best', legendSpec:{type:'point', color:text, point:{shape:'ring', stroke:text, radius:4.5, width:2}}},
  ];
  // Your setting sits on the line when it is one of the tested values, and beside
  // it on a number axis when it is not.
  const baseY=optPlotVal(mk, R.base[mk]);
  if(isNum || baseIdx>=0) datasets.push({label:'Your current setting', data:isNum ? [{x:Number(R.baseVals[0]), y:baseY}] : only(baseIdx, baseY),
    showLine:false, pointStyle:'rect', pointRadius:5, pointHoverRadius:6, borderColor:mark, backgroundColor:mark, _opt:'base',
    legendSpec:{type:'point', color:mark, point:{shape:'rect', fill:mark, radius:4}}});
  const legendEl=$('optLegend'); legendEl.innerHTML='';
  datasets.forEach((ds,idx)=>{
    const item=document.createElement('div'); item.className='legend-item';
    SharedLegend.attach(item, SharedLegend.specOf(ds), ds.label);
    item.addEventListener('click',()=>{ if(!optChart) return; const vis=!optChart.isDatasetVisible(idx); optChart.setDatasetVisibility(idx, vis); item.classList.toggle('hidden', !vis); optChart.update(); });
    legendEl.appendChild(item);
  });
  const xs=isNum ? vals.concat([Number(R.baseVals[0])]).filter(isFinite) : null;
  const xmin=isNum ? Math.min.apply(null, xs) : 0, xmax=isNum ? Math.max.apply(null, xs) : vals.length-1;
  // Tick labels carry as many decimals as the step between them needs, so a
  // narrow range does not print the same label down the whole axis.
  const tickDp=ticks=>{ const st=ticks && ticks.length>1 ? Math.abs(ticks[1].value-ticks[0].value) : 1; return st>0 && st<1 ? Math.min(4, Math.ceil(-Math.log10(st)+1e-9)) : 0; };
  const yTick=(v,_i,ticks)=>meta.kind==='pct' ? fmt.num(v, Math.max(tickDp(ticks), Math.abs(v)<10?1:0))+'%' : meta.kind==='money' ? fmt.currency(v,true) : fmt.num(v, Math.max(2, tickDp(ticks)));
  // Every run level (to rounding): draw the line across the middle of a modest
  // axis instead of stretching rounding noise to fill it.
  const ys=vals.map((_,i)=>yAt(i)).filter(v=>v!=null);
  const yLo=ys.length ? Math.min.apply(null, ys) : 0, yHi=ys.length ? Math.max.apply(null, ys) : 0;
  const flat=ys.length>0 && yHi-yLo<=optTol(yHi)*100;
  const flatPad=Math.max(Math.abs(yHi)*0.05, meta.kind==='pct' ? 0.5 : meta.kind==='money' ? 1 : 0.05);
  const xLabel=ctx=>isNum ? s.fmt(ctx.parsed.x) : (s.fmt(vals[ctx.dataIndex]));
  const yText=ctx=>{ const raw=ctx.parsed.y; return raw==null ? 'not run' : optMetricFmt(mk, meta.kind==='pct' ? raw/100 : raw); };
  const opts={
    responsive:true, maintainAspectRatio:false, animation:{duration:300},
    interaction:{mode:'nearest', axis:'x', intersect:false},
    // A click picks the tested value nearest the pointer for the charts below.
    onClick:(evt, _els, chart)=>{
      const hit=chart.getElementsAtEventForMode(evt, 'nearest', {axis:'x', intersect:false}, false).find(e=>e.datasetIndex===0);
      if(hit) optSetPick([hit.index]);
    },
    plugins:{ legend:{display:false}, tooltip:SharedChartTip.options({
      filter:item=>item.dataset._opt!=='best',
      callbacks:{ title:ctx=>ctx[0] ? s.label+': '+xLabel(ctx[0]) : '', label:ctx=>`  ${ctx.dataset.label}: ${yText(ctx)}`,
        afterBody(items){ if(items.length) $('optHoverBox').textContent=`${s.label} ${xLabel(items[0])}  -  `+items.map(i=>`${i.dataset.label}: ${yText(i)}`).join('  |  '); }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:text, bodyColor:muted, borderColor:grid, borderWidth:1, padding:10}),
      zoom:SharedZoom.options({min:xmin, max:xmax, points:vals.length}),
      sharedYFit:{auto:{axes:['y']}}},
    scales:{
      x: isNum
        ? {type:'linear', title:{display:true,text:s.label+optUnitBracket(s),color:muted,font:{size:11}}, ticks:{color:muted,maxTicksLimit:12,font:{size:11},callback:v=>s.fmt(v)}, grid:{color:grid}}
        : {type:'category', title:{display:true,text:s.label,color:muted,font:{size:11}}, ticks:{color:muted,font:{size:11}}, grid:{color:grid}},
      y:Object.assign({title:{display:true,text:optAxisTitle(mk),color:muted,font:{size:11}}, ticks:{color:muted,font:{size:11},callback:yTick}, grid:{color:grid}},
        flat ? {min:yHi-flatPad, max:yHi+flatPad} : {})}
  };
  // A level line has nothing for the y refit to fit, so it keeps its fixed axis.
  if(flat) delete opts.plugins.sharedYFit;
  if(optChart) optChart.destroy();
  optChart=new Chart($('optCanvas'),{type:'line', data:isNum ? {datasets} : {labels:vals.map(v=>s.fmt(v)), datasets}, options:opts, plugins:[SharedZoom.plugin]});
  optChart.update();
  $('optHoverBox').textContent='Hover to read each tested value, click one to show it below.';
}
let _plotlyPromise=null;
// Plotly (~3.5 MB) draws only the two-setting surface, so it loads on first use.
function ensurePlotly(){
  if(window.Plotly) return Promise.resolve();
  if(_plotlyPromise) return _plotlyPromise;
  _plotlyPromise=new Promise((resolve,reject)=>{
    const sc=document.createElement('script');
    sc.src='https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly.min.js';
    sc.onload=()=>resolve();
    sc.onerror=()=>{ _plotlyPromise=null; reject(new Error('Failed to load Plotly')); };
    document.head.appendChild(sc);
  });
  return _plotlyPromise;
}
const OPT_CAMERA={eye:{x:1.65, y:-1.65, z:1.05}};
function drawOptSurface(){
  const R=optResult; if(!R) return Promise.resolve();
  const mk=optMetricKey(), meta=OPT_METRICS[mk];
  const [s0,s1]=R.specs, [v0,v1]=R.values, n0=v0.length;
  const axisVals=(s,vals)=>s.kind==='num' ? vals.slice() : vals.map((_,i)=>i);
  const xs=axisVals(s0,v0), ys=axisVals(s1,v1);
  const z=[], txt=[];
  for(let j=0;j<v1.length;j++){
    const row=[], trow=[];
    for(let i=0;i<n0;i++){
      const raw=optVal(R, i+j*n0, mk);
      row.push(optPlotVal(mk, raw));
      trow.push(escapeHtml(s0.label)+': '+escapeHtml(s0.fmt(v0[i]))+'<br>'+escapeHtml(s1.label)+': '+escapeHtml(s1.fmt(v1[j]))+'<br>'+
        escapeHtml(meta.label)+': '+(raw==null ? 'not run' : escapeHtml(optMetricFmt(mk, raw))));
    }
    z.push(row); txt.push(trow);
  }
  const text=cssVar('--text'), muted=cssVar('--chart-text'), grid=cssVar('--chart-grid'), mark=cssVar('--muted');
  const best=optBestIdx(R, mk);
  const at=(s,vals,v)=>s.kind==='num' ? Number(v) : vals.findIndex(x=>String(x)===String(v));
  // hovertext, not hovertemplate '%{text}': Plotly looks %{text} up as text[x][y] on a
  // surface (transposed), so it showed the wrong cell or a raw '%{text}' off a square grid.
  const data=[{type:'surface', x:xs, y:ys, z, hovertext:txt, hoverinfo:'text',
    colorscale:[[0, cssVar('--gold')], [0.5, cssVar('--line-c')], [1, cssVar('--line-a')]],
    colorbar:{title:{text:optAxisTitle(mk), side:'right', font:{color:muted, size:11}}, tickfont:{color:muted, size:10}, thickness:12, len:0.75},
    contours:{z:{show:true, usecolormap:true, project:{z:false}}}}];
  if(best>=0){
    const bv=optValsAt(R, best);
    data.push({type:'scatter3d', mode:'markers', name:'Best', x:[at(s0,v0,bv[0])], y:[at(s1,v1,bv[1])], z:[optPlotVal(mk, optVal(R,best,mk))],
      marker:{symbol:'circle-open', size:9, color:text, line:{width:3, color:text}}, hovertemplate:'Best<extra></extra>'});
  }
  const bx=at(s0,v0,R.baseVals[0]), by=at(s1,v1,R.baseVals[1]);
  const hasBase=bx>=0 && by>=0 && isFinite(bx) && isFinite(by);
  if(hasBase) data.push({type:'scatter3d', mode:'markers', name:'Your current setting', x:[bx], y:[by], z:[optPlotVal(mk, R.base[mk])],
    marker:{symbol:'square', size:5, color:mark}, hovertemplate:'Your current setting<extra></extra>'});
  const ax=(s,vals)=>Object.assign({title:{text:s.label+(s.kind==='num'?optUnitBracket(s):'')}, color:muted, gridcolor:grid, zerolinecolor:grid, showbackground:false},
    s.kind==='list' ? {tickvals:vals.map((_,i)=>i), ticktext:vals.map(v=>s.fmt(v))} : {});
  const zt=meta.kind==='pct' ? {ticksuffix:'%'} : meta.kind==='money' ? {tickprefix:currentCurrencySymbol||'', tickformat:',.0f'} : {tickformat:'.2f'};
  const layout={autosize:true, margin:{l:0, r:0, t:0, b:0}, paper_bgcolor:'rgba(0,0,0,0)', showlegend:false,
    font:{family:'DM Sans, sans-serif', color:text},
    scene:{xaxis:ax(s0,v0), yaxis:ax(s1,v1), zaxis:Object.assign({title:{text:optAxisTitle(mk)}, color:muted, gridcolor:grid, zerolinecolor:grid, showbackground:false}, zt),
      camera:OPT_CAMERA},
    uirevision:'opt'};
  // The key under the chart: the two marks (the colour bar names the surface).
  const legendEl=$('optLegend'); legendEl.innerHTML='';
  const items=[[{type:'area', fill:cssVar('--line-a'), fill2:cssVar('--gold')}, meta.label+', blue high, gold low']];
  if(best>=0) items.push([{type:'point', color:text, point:{shape:'ring', stroke:text, radius:4.5, width:2}}, 'Best']);
  if(hasBase) items.push([{type:'point', color:mark, point:{shape:'rect', fill:mark, radius:4}}, 'Your current setting']);
  items.forEach(([spec,label])=>{ const it=document.createElement('div'); it.className='legend-item'; it.style.cursor='default'; SharedLegend.attach(it, spec, label); legendEl.appendChild(it); });
  $('optHoverBox').textContent='Drag to turn the surface, scroll to zoom, hover to read a run, click one to show it below.';
  // A tested value on an axis, from where a click landed on it.
  const idxOn=(s,vals,x)=>s.kind==='num' ? vals.findIndex(v=>Math.abs(v-x)<=1e-9*Math.max(1,Math.abs(v))) : Math.round(x);
  return ensurePlotly()
    .then(()=>Plotly.react('optSurface', data, layout, {responsive:true, displayModeBar:false, displaylogo:false}))
    .then(()=>{
      surfaceDrawn=true;
      const el=$('optSurface');
      if(!surfaceClickWired && el.on){
        surfaceClickWired=true;
        el.on('plotly_click', ev=>{
          const p=ev && ev.points && ev.points[0], R2=optResult; if(!p || !R2 || R2.specs.length!==2) return;
          optSetPick([idxOn(R2.specs[0], R2.values[0], p.x), idxOn(R2.specs[1], R2.values[1], p.y)]);
        });
      }
    })
    .catch(()=>{ $('optSurface').innerHTML='<p style="padding:20px;text-align:center;color:var(--muted)">Could not load the 3D plotting library (Plotly). Check your connection and try again.</p>'; });
}
function wmPlotlyImage(){
  return { source:WM_LOGO_SRC, xref:'paper', yref:'paper', x:1, y:0.07, xanchor:'right', yanchor:'bottom',
    sizex:0.035, sizey:0.05, sizing:'contain', opacity:0.22, layer:'above' };
}
// A surface export carries the title and the watermark the canvas exports do.
async function withSurfaceMarks(fn){
  await ensurePlotly();
  const isLight=document.body.classList.contains('light');
  const title={ xref:'paper', yref:'paper', x:0.5, y:1.06, xanchor:'center', yanchor:'bottom', showarrow:false,
    text:'<b>'+escapeHtml(optChartTitle())+'</b>', font:{ size:14, color:isLight?'#2D3436':'#EAF1FF', family:'DM Sans, sans-serif' } };
  const wm={ xref:'paper', yref:'paper', x:1, y:0, xanchor:'right', yanchor:'bottom', showarrow:false,
    text:'Made using tool.adjiebrotots.com/dcasimulator', font:{ size:10, color:'rgba(60,60,60,0.22)', family:'DM Sans, sans-serif' } };
  const bg=isLight?'#ffffff':'#0F1728';
  await Plotly.relayout('optSurface', { annotations:[title, wm], images:[wmPlotlyImage()], paper_bgcolor:bg, 'margin.t':40 });
  try { return await fn(); }
  finally { await Plotly.relayout('optSurface', { annotations:[], images:[], paper_bgcolor:'rgba(0,0,0,0)', 'margin.t':0 }); }
}
function surfaceOnBoard(){ return !!(optResult && optResult.specs.length===2 && surfaceDrawn); }
function optChartTitle(){
  if(!optResult) return 'DCA Scenario Explorer: Optimisation';
  return 'DCA Scenario Explorer: '+OPT_METRICS[optMetricKey()].label+' by '+optResult.specs.map(s=>s.label).join(' and ');
}

/* ── The answer, the tiles and the caveats for a sweep ── */
function renderOptVerdict(){
  const el=$('verdict'), R=optResult; if(!el || !R) return;
  const num=t=>'<span class="v-num">'+escapeHtml(t)+'</span>';
  const nm=t=>'<span data-no-abbr>'+escapeHtml(t)+'</span>';
  const mk=optMetricKey(), meta=OPT_METRICS[mk];
  const ran=R.grid.filter(g=>g.m).length, skipped=R.grid.length-ran;
  const best=optBestIdx(R, mk), worst=optWorstIdx(R, mk);
  const phrase=vals=>R.specs.map((s,k)=>nm(s.label)+' at '+num(s.fmt(vals[k]))).join(' and ');
  const skipNote=skipped ? ' '+skipped+(skipped===1?' combination':' combinations')+' could not run.' : '';
  if(best<0){
    SharedVerdict.set(el, { tone:'', title:'None of the tested settings gave a '+meta.label+'.',
      body:'Every run left '+meta.label+' undefined, usually because no money went in. Widen the range or pick another figure to rank by.'+skipNote });
    return;
  }
  const bv=optVal(R,best,mk), wv=optVal(R,worst,mk), cur=R.base[mk];
  const tol=optTol;
  const ties=R.grid.filter((g,i)=>{ const v=optVal(R,i,mk); return v!=null && Math.abs(v-bv)<=tol(bv); }).length;
  const bestVals=optValsAt(R, best);
  const what=R.specs.length===1 ? 'value' : 'combination';
  let title;
  if(Math.abs(bv-wv)<=tol(bv)) title=R.specs.map(s=>nm(s.label)).join(' and ')+' made no difference to '+meta.label+' here: every tested '+what+' gave '+num(optMetricFmt(mk,bv))+'.';
  else if(ties>1) title=meta.label+' tops out at '+num(optMetricFmt(mk,bv))+', reached by '+ties+' of the '+ran+' tested, the first with '+phrase(bestVals)+'.';
  else if(optIsBase(R, bestVals)) title='Your current setting is already the best '+meta.label+' of the '+ran+' tested: '+num(optMetricFmt(mk,bv))+'.';
  else title=meta.label+' peaks at '+num(optMetricFmt(mk,bv))+' with '+phrase(bestVals)+', against '+num(optMetricFmt(mk,cur))+' as you have it set.';
  // A rate of return can be won by putting less in (a threshold that rarely
  // fires, a smaller amount), so when the best run's top-ups differ from the
  // reader's, the answer says so rather than let a rate pass for money.
  const bdep=R.grid[best].m.dep, cdep=R.base.dep;
  const lessMoney=mk!=='final' && mk!=='net' && !optIsBase(R, bestVals) && Math.abs(bdep-cdep)>Math.max(1, Math.abs(cdep)*0.005);
  const body=(Math.abs(bv-wv)<=tol(bv) ? '' : 'The lowest, '+num(optMetricFmt(mk,wv))+', came with '+phrase(optValsAt(R, worst))+'. ')+
    (lessMoney ? 'The best run topped up '+num(fmt.currency(bdep))+' against '+num(fmt.currency(cdep))+' at your setting, so Final value or Net under Show compares the money itself. ' : '')+
    'Tested '+ran+' '+(ran===1?what:what+'s')+' on '+nm(R.name)+'.'+skipNote;
  SharedVerdict.set(el, { tone:'', title, body });
}
function updateOptSummary(){
  const sg=$('summaryGrid'), R=optResult; if(!sg || !R) return;
  const mk=optMetricKey(), meta=OPT_METRICS[mk];
  const best=optBestIdx(R, mk), worst=optWorstIdx(R, mk);
  const tiles=[];
  if(best>=0) tiles.push({title:'Best '+meta.label, sub:optSettingText(R, optValsAt(R,best)), m:R.grid[best].m, color:cssVar('--gold')});
  tiles.push({title:'Your current setting', sub:R.specs.map((s,k)=>s.label+' '+s.fmt(R.baseVals[k])).join(', '), m:R.base, color:getSecColor(R.S0)});
  if(worst>=0 && worst!==best) tiles.push({title:'Worst '+meta.label, sub:optSettingText(R, optValsAt(R,worst)), m:R.grid[worst].m, color:cssVar('--muted')});
  const advStyle=`display:${showAdvanced?'grid':'none'}`;
  // The figure the sweep is ranked by leads each tile's figures, unless the tile
  // already shows it (final value, net and ROI always do).
  const shownAlready=mk==='final' || mk==='net' || mk==='roi';
  sg.innerHTML=tiles.map(t=>`<div class="tile" style="border-left:3px solid ${t.color}">
      <div class="label">${escapeHtml(t.title)}</div>
      <div style="font-size:.74rem;color:var(--muted);margin:1px 0 4px" data-no-abbr>${escapeHtml(t.sub)}</div>
      <div class="value">${fmt.currency(t.m.final)}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-top:3px">${shownAlready ? '' : escapeHtml(meta.label)+' <b>'+escapeHtml(optMetricFmt(mk, t.m[mk]))+'</b> | '}Net: ${fmt.currency(t.m.net)} | ROI: ${fmt.pct(t.m.roi)}</div>
      <div style="font-size:.75rem;color:var(--muted)">Topped up: ${fmt.currency(t.m.dep)} | Trades: ${t.m.trades}</div>
      <div class="adv-metrics" style="${advStyle}">
        ${metricCell('Sharpe', fmtRatio(t.m.sharpe), METRIC_TIPS.sharpe)}
        ${metricCell('Sortino', fmtRatio(t.m.sortino), METRIC_TIPS.sortino)}
        ${metricCell('CAGR (TWR)', fmtMetPct(t.m.twr), METRIC_TIPS.twr)}
        ${metricCell('CAGR (MWR)', fmtMetPct(t.m.mwr), METRIC_TIPS.mwr)}
      </div>
    </div>`).join('');
}
// The lines a sweep adds to What this assumes.
function optAssumptionLines(){
  const R=optResult; if(!R) return [];
  const nm=t=>'<span data-no-abbr>'+escapeHtml(t)+'</span>';
  const parts=R.specs.map((s,k)=>{
    let t=nm(s.label)+' from '+escapeHtml(optRangeText(s, R.values[k]));
    if(s.key==='period') t+=', the amount per top-up following it so each year\'s money stays the same';
    return t;
  });
  return [
    '<strong>Only '+nm(R.name)+' runs, '+R.grid.length+' times,</strong> with '+parts.join(' and ')+'. Everything else stays as set.',
    '<strong>The best setting is the best for these past prices,</strong> not a forecast: a sweep finds what suited this stretch, and the next one can differ.'
  ];
}

/* ─── SIMULATE BUTTON GATING ──────────────────────────────────────────────────
   The Simulate button is greyed out (but still hoverable) whenever a required
   input is missing, with the reason surfaced as a tooltip on hover. ──────────── */
function simBlockReason(){
  // Optimise runs the active scenario alone, so only it has to be ready.
  if(optVars.length){
    const sec=getActiveSec();
    if(!sec) return 'Add a scenario to optimise.';
    if(!$('startDate').value || !$('endDate').value) return 'Set a start and end date in the Data tab.';
    if(sec.type==='ticker' && !sec.ticker) return 'Pick a ticker for this scenario (load tickers in the Data tab first).';
    const plan=optPlan(sec);
    for(let k=0;k<optVars.length;k++){
      const sp=plan.specs[k];
      if(!sp) return 'A swept setting no longer applies. Pick it again.';
      if(plan.values[k].length<2) return sp.kind==='list' ? `${sp.label}: pick at least two values.` : `${sp.label}: Start and End give one value. Widen the range.`;
    }
    if(plan.runs>OPT_MAX_RUNS) return `${plan.runs} runs is more than the ${OPT_MAX_RUNS} an optimisation allows. Lower the steps.`;
    return '';
  }
  if(!securities.length) return 'Add at least one scenario to simulate.';
  if(!$('startDate').value || !$('endDate').value) return 'Set a start and end date in the Data tab.';
  // A Ticker scenario with no ticker chosen can't run (runSimulation can still
  // fetch a chosen-but-uncached ticker, so only an empty selection is a blocker).
  if(securities.some(s=>s.type==='ticker' && !s.ticker))
    return 'Pick a ticker for every Ticker scenario (load tickers in the Data tab first).';
  return '';
}
function updateSimBtnState(){
  const b=$('simBtn'); if(!b || b.dataset.running==='1') return;
  const reason=simBlockReason();
  if(reason){ b.classList.add('is-disabled'); b.setAttribute('aria-disabled','true'); b.setAttribute('data-tip',reason); }
  else { b.classList.remove('is-disabled'); b.removeAttribute('aria-disabled'); b.removeAttribute('data-tip'); }
}

/* ─── PREPARE A RUN ─── */
// Fetch any uncovered ticker, build each scenario's price series and put them on
// the trading days they all share. Returns {loadedSecs, axis}, or null after
// saying why there is nothing to run. Simulate prepares every scenario, Optimise
// only the one it sweeps.
async function prepareRun(secs, startDate, endDate){
  showStatus($('fetchStatus'),'Preparing simulation...','loading');

  // Reset stale data before rebuilding this run.
  secs.forEach(sec => { sec.priceData = null; sec.loaded = false; });

  // Ticker data should already be pooled and cached (loaded up front in one
  // request). If anything is missing or the date range moved outside the cached
  // window, fetch ONLY those tickers - and do it in a SINGLE batched request
  // rather than one-by-one - so we keep Worker invocations to a minimum.
  const uniqueTickers = [...new Set(secs
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
  for(const sec of secs){
    if(sec.type==='custom'){
      // Seed on the asset's identity only (name + return + volatility) so its
      // simulated price path is stable across DCA styles/amounts — otherwise
      // comparing two styles would compare two different price histories. Matches
      // the portfolio tool's seeding.
      const secSeed = deriveSeed(currentRandomSeed, `${sec.name}|${sec.returnPct}|${sec.stdPct}`);
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
  const loadedSecs = secs.filter(s=>s.priceData&&s.priceData.dates.length);
  if(!loadedSecs.length){ showWarning('No securities with data loaded.'); return null; }

  // Every scenario runs on the trading days they all share, as the Portfolio
  // tool does. Trimming only the range left each scenario on its own calendar,
  // so two markets with different holidays (or a 7-day crypto series) drew
  // their points under each other's dates on the charts.
  const aligned = alignToCommonDates(loadedSecs.map(s=>s.priceData));
  if(aligned[0].dates.length<2){ showWarning('No overlapping trading days between scenarios.'); return null; }
  loadedSecs.forEach((sec,k)=>{ sec.priceData=aligned[k]; });
  return { loadedSecs, axis:aligned[0].dates };
}

/* ─── RUN SIMULATION ─── */
async function runSimulation(){
  // With settings picked to sweep, the gate runs the sweep instead.
  if(optVars.length) return runOptimisation();
  if(persist) persist.schedule(); // runSimulation follows every scenario/input change — save it
  const blocked=simBlockReason();
  if(blocked){ showWarning(blocked); return; }

  const startDate=$('startDate').value;
  const endDate=$('endDate').value;

  const simBtn=$('simBtn');
  simBtn.dataset.running='1';
  simBtn.disabled=true;
  simBtn.classList.remove('is-disabled');
  simBtn.removeAttribute('data-tip');
  simBtn.innerHTML='<span class="spinner"></span>Running…';

  try{
  const prep = await prepareRun(securities, startDate, endDate);
  if(!prep) return;
  const loadedSecs = prep.loadedSecs, axis = prep.axis;

  showStatus($('dateRangeStatus'),`Date range: ${axis[0]} → ${axis[axis.length-1]} (${axis.length} days)`,'ok');

  // Run simulations
  simResults=[];
  for(const sec of loadedSecs){
    try {
      const res=simulateSecurity(sec, currentExecTiming);
      simResults.push({sec, ...res});
    } catch(e){
      console.error('Sim error for '+sec.name, e);
    }
  }

  if(!simResults.length){ showWarning('Simulation produced no results.'); return; }
  optResult=null; setBoardMode();   // the board is a comparison again
  // Say so when a fill had to stand in for a missing open, or a decision on the
  // last day had no next day to fill on.
  const notes=[];
  simResults.forEach(r=>{
    if(r.openProxied) notes.push(`${r.sec.name}: ${r.openProxied} trade(s) at the previous close, no open price in the data`);
    if(r.unfilled) notes.push(`${r.sec.name}: ${r.unfilled} decision(s) on the last day not filled`);
  });
  if(notes.length) showStatus($('dateRangeStatus'),`Date range: ${axis[0]} → ${axis[axis.length-1]} (${axis.length} days). ${notes.join('. ')}.`,'warn');

  hideStatus($('fetchStatus'));
  updatePriceChart();
  updateEquityChart();
  updateTables();
  markFresh();   // what is on screen is the plan the form describes again
  } finally {
    simBtn.disabled=false;
    delete simBtn.dataset.running;
    updateSimBtn();
    updateSimBtnState();
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
    // Only the price chart carries _ohlc datasets - leave the equity chart untouched.
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
      // Oscillator overlays (RSI/MACD/ADX) live on their own axes - never fold
      // them into the price scale or they'd flatten the candles.
      if(typeof ds.yAxisID==='string' && ds.yAxisID.indexOf('yOsc_')===0) return;
      if(ds._ohlc){
        const {h,l}=ds._ohlc;
        const end=Math.min(h.length-1,iMax);
        for(let i=Math.max(0,iMin);i<=end;i++){ if(h[i]!=null&&h[i]>hi)hi=h[i]; if(l[i]!=null&&l[i]<lo)lo=l[i]; }
      } else {
        // Price-axis overlays/markers (moving averages, Bollinger bands, buy
        // triangles) - keep them in view too.
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
      const ud=upDownColors();
      for(let i=0;i<c.length;i++){
        if(c[i]==null||o[i]==null) continue;
        const px=x.getPixelForValue(i);
        if(px<area.left-w||px>area.right+w) continue;
        const up=c[i]>=o[i], col=up?ud.up:ud.down;
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
    // Candlestick mode draws no line at all, so the key shows a candle; line
    // mode shows the line itself, at the width the chart strokes it with. The
    // spec is stated once here and pinned to the dataset below, so the hover
    // card answers with the very same mark.
    const spec = showCandles ? {type:'candle', color, fill:color} : {color, width:2.5};
    SharedLegend.attach(item, spec, label);
    // Toggling rebuilds the chart so normalisation (actual ↔ base-100) and the
    // axis title follow the new visible count.
    item.addEventListener('click',()=>{
      if(priceHidden.has(idx)) priceHidden.delete(idx); else priceHidden.add(idx);
      updatePriceChart();
    });
    legendEl.appendChild(item);
    const ds={ label, hidden, legendSpec:spec,
      data:res.dailyRows.map(r=>priceVal(res,r.price)),
      borderColor: showCandles ? 'transparent' : color,
      backgroundColor:color+'22', borderWidth:2.5, pointRadius:0,
      pointHoverRadius:showCandles?0:5, tension:0.2, fill:false };
    if(showCandles) ds._ohlc=buildOHLC(res);
    return ds;
  });

  // The triangles below are the same mark for every series, so the key says so
  // once, with the triangle it actually draws.
  if(showBuyDates && series.length){
    const note=document.createElement('div');
    note.className='legend-item';
    note.style.cursor='default';
    SharedLegend.attach(note, {type:'point', color:cssVar('--muted'),
      point:{shape:'triangle', fill:cssVar('--muted'), radius:3.4}}, 'Buy date');
    legendEl.appendChild(note);
  }

  // Buy markers (▲) - one small upward triangle per purchase date, just below
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
        pointBorderColor:cssVar('--card-bg')||'#fff', pointBorderWidth:0.5, _marker:true
      });
    });
  }

  // Technical overlays, computed lazily and only while toggled on. Price-axis
  // overlays (moving averages, Bollinger bands) share the price grid; oscillator
  // indicators (RSI, MACD, ADX) each get their own grid stacked below the price
  // grid - same canvas, same X-axis - grouped by indicator family (OSC_GROUPS) so
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
            categoryPercentage:1, barPercentage:1, _indicator:true, _hist:true,
            legendSpec:{type:'bar', color:cssVar('--muted'), fill:cssVar('--muted')}
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
  // Indicator overlays were drawn without ever appearing in the key: a handful
  // of faint dashed and dotted lines with nothing to say what they were. Each
  // one now gets an entry carrying its own line, read off the dataset that
  // draws it (the MACD histogram included, as the bar it is).
  datasets.filter(ds=>ds._indicator).forEach(ds=>{
    const note=document.createElement('div');
    note.className='legend-item'; note.style.cursor='default';
    SharedLegend.attach(note, SharedLegend.specOf(ds), ds.label);
    legendEl.appendChild(note);
  });

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
  const yTitle= normalize ? 'Normalised Price (base 100)' : 'Price'+symInBrackets();
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
      plugins:{ legend:{display:false}, tooltip:SharedChartTip.options({
        filter:item=>!item.dataset._marker,
        callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>'  '+fmtPt(ctx),
          afterBody(items){ const its=items.filter(i=>!i.dataset._marker); if(its.length) $('priceHoverBox').textContent=`${its[0].label}  -  `+its.map(fmtPt).join('  |  '); }},
        backgroundColor:cssVar('--panel')||'#11172a', titleColor:textColor, bodyColor:mutedColor, borderColor:gridColor, borderWidth:1, padding:10}),
        /* The shared gesture block. A category axis is already bounded by its
         labels, but nothing stops a pinch from shrinking the window to a
         couple of days, so it carries the same floor every other chart on the
         site does (SharedZoom, shared.js). */
      zoom:SharedZoom.options({min:0,max:Math.max(0,allDates.length-1),points:allDates.length}),
      /* ...and every pane's y axis follows the x window: zoom into six months
         of a ten-year series and the prices there fill the pane instead of
         flattening against a scale built for the whole run. The oscillator
         grids below are refitted in the same pass. */
      sharedYFit:{auto:{axes:['y'].concat(oscGroupKeys.map(k=>'yOsc_'+k))}}},
      scales
    };
  }

  if(priceChartInstance){
    // New data means a new view: a window left by a pan or a pinch is dropped.
    SharedZoom.resetView(priceChartInstance);
    priceChartInstance.data.labels=allDates;
    priceChartInstance.data.datasets=datasets;
    // Rebuilt options carry the limits for the dates now plotted, so a longer
    // or shorter run means a longer or shorter axis to pan across.
    priceChartInstance.options=buildPriceOpts();
    priceChartInstance.update('none');
  } else {
    // SharedPane (shared.js) keeps each stacked pane's axis text inside its pane.
    priceChartInstance=new Chart($('priceCanvas'),{type:'line',data:{labels:allDates,datasets},options:buildPriceOpts(),plugins:[SharedZoom.plugin,SharedPane.plugin]});
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
    SharedLegend.attach(item, {color, width:2.5}, res.sec.name);
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

  if(showDeposited && simResults.length){
    const note=document.createElement('div');
    note.className='legend-item';
    note.style.cursor='default';
    SharedLegend.attach(note, {color:cssVar('--muted'), width:1.5, dash:[5,4]}, 'Total deposited (per scenario)');
    legendEl.appendChild(note);
  }

  const yCallback=val=>fmt.currency(val,true);

  function buildEquityOpts(){ return {
    responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:SharedChartTip.options({
      filter:item=>equityChartInstance?equityChartInstance.isDatasetVisible(item.datasetIndex):true,
      callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>`  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`,
        afterBody(items){ if(items.length) $('equityHoverBox').textContent=`${items[0].label}  -  `+items.map(i=>`${i.dataset.label}: ${fmt.currency(i.parsed.y,true)}`).join('  |  '); }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:textColor, bodyColor:mutedColor, borderColor:gridColor, borderWidth:1, padding:10}),
      zoom:SharedZoom.options({min:0,max:Math.max(0,allDates.length-1),points:allDates.length}),
      // The y axis follows the x window, so a zoom into the early months
      // shows the shape there rather than a flat line under a scale built for
      // the final balance (SharedZoom, shared.js).
      sharedYFit:{auto:{axes:['y']}}},
    scales:{ x:{title:{display:true,text:'Date',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,maxTicksLimit:12,font:{family:'inherit',size:11},callback:v=>allDates[Number(v)]?.slice(0,7)||''},grid:{color:gridColor}},
              y:{title:{display:true,text:'Portfolio Value'+symInBrackets(),color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,font:{family:'inherit',size:11},callback:yCallback},grid:{color:gridColor}}}
  };}

  if(equityChartInstance){
    // New data means a new view: a window left by a pan or a pinch is dropped.
    SharedZoom.resetView(equityChartInstance);
    equityChartInstance.data.labels=allDates; equityChartInstance.data.datasets=datasets;
    equityChartInstance.options.scales.x.ticks.color=mutedColor; equityChartInstance.options.scales.x.grid.color=gridColor;
    equityChartInstance.options.scales.x.ticks.callback=v=>allDates[Number(v)]?.slice(0,7)||'';
    equityChartInstance.options.scales.x.title.color=mutedColor;
    equityChartInstance.options.scales.y.ticks.color=mutedColor; equityChartInstance.options.scales.y.grid.color=gridColor;
    equityChartInstance.options.scales.y.ticks.callback=yCallback;
    equityChartInstance.options.scales.y.title.color=mutedColor;
    equityChartInstance.options.scales.y.title.text='Portfolio Value ('+currentCurrencySymbol+')';
    equityChartInstance.options.plugins.zoom=SharedZoom.options({min:0,max:Math.max(0,allDates.length-1),points:allDates.length});
    equityChartInstance.update('none');
    // re-apply deposited visibility
    datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  } else {
    equityChartInstance=new Chart($('equityCanvas'),{type:'line',data:{labels:allDates,datasets},options:buildEquityOpts(),plugins:[SharedZoom.plugin]});
    datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  }
}

$('priceResetZoom').addEventListener('click',()=>{ if(priceChartInstance) priceChartInstance.resetZoom(); });
$('equityResetZoom').addEventListener('click',()=>{ if(equityChartInstance) equityChartInstance.resetZoom(); });
$('priceCanvas').addEventListener('mouseleave',()=>{ $('priceHoverBox').textContent='Hover to inspect data points.'; });
$('equityCanvas').addEventListener('mouseleave',()=>{ $('equityHoverBox').textContent='Hover to inspect data points.'; });

// The "Show Indicators" toggle is only meaningful when at least one security
// runs a technical-indicator strategy - hide it otherwise.
function updateTechToggleVisibility(){
  const wrap=$('techToggleWrap'); if(!wrap) return;
  const anyTech=securities.some(s=>TECH_STYLES.includes(s.style));
  wrap.style.display=anyTech?'':'none';
}

$('showDepositedToggle').addEventListener('change',e=>{
  showDeposited=e.target.checked;
  // Rebuilt rather than toggled, so the key loses its dashed entry with the
  // dashed lines instead of explaining a line that is no longer drawn.
  if(equityChartInstance&&simResults.length) updateEquityChart();
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
  renderAssumptions();
  // Toggle visibility in place - metrics are already rendered in each tile.
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
  if(optResult) return updateOptSummary();   // a sweep: best, your setting and worst
  sg.innerHTML='';
  if(!simResults.length) return;

  const advStyle=`display:${showAdvanced?'grid':'none'}`;
  simResults.forEach(res=>{
    // Guard against a strategy that never invested in range (e.g. a technical
    // trigger that never fired with End-of-Period off) → no division by zero.
    const roi=res.totalDeposited>0?(res.finalEquity-res.totalDeposited)/res.totalDeposited:0;
    const m=computeMetrics(res);
    sg.innerHTML+=`
      <div class="tile" style="border-left:3px solid ${getSecColor(res.sec)}">
        <div class="label">${res.sec.name}</div>
        <div class="value">${fmt.currency(res.finalEquity)}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:3px">ROI: ${fmt.pct(roi)} | Topped up: ${fmt.currency(res.totalDeposited)}</div>
        <div style="font-size:.75rem;color:var(--muted)">Trades: ${res.investRows.length}</div>
        <div class="adv-metrics" style="${advStyle}">
          ${metricCell('Sharpe', fmtRatio(m.sharpe), METRIC_TIPS.sharpe)}
          ${metricCell('Sortino', fmtRatio(m.sortino), METRIC_TIPS.sortino)}
          ${metricCell('CAGR (TWR)', fmtMetPct(m.cagrTwr), METRIC_TIPS.twr)}
          ${metricCell('CAGR (MWR)', fmtMetPct(m.cagrMwr), METRIC_TIPS.mwr)}
        </div>
      </div>`;
  });
}

/* ─── TABLES ─── */
function updateTables(){
  if(!simResults.length) return;

  // Summary grid
  renderSummary();

  // Detail scenario selector (dropdown)
  if(activeDetailSec>=simResults.length) activeDetailSec=0;
  const sel=$('detailSelect');
  sel.innerHTML=simResults.map((res,i)=>`<option value="${i}">${res.sec.name}</option>`).join('');
  sel.value=String(activeDetailSec);
  renderDetailTable(activeDetailSec);

  latestRows=simResults[0].dailyRows;
  renderVerdict();
  renderAssumptions();
}

/* ─── THE ANSWER, IN ONE SENTENCE ───
   The scenarios are options a reader is weighing, so the verdict is neutral:
   which ended highest, and by how much. When they put different amounts in,
   more money in is not a better strategy, so it compares the return on what
   went in instead. */
function renderVerdict(){
  const el=$('verdict'); if(!el || !window.SharedVerdict) return;
  if(optResult) return renderOptVerdict();
  if(!simResults.length){ SharedVerdict.set(el, null); return; }
  const num=t=>'<span class="v-num">'+escapeHtml(t)+'</span>';
  const nm=t=>'<span data-no-abbr>'+escapeHtml(t)+'</span>';
  const rows=simResults.map(res=>({ name:res.sec.name||'Scenario', fin:res.finalEquity, dep:res.totalDeposited,
    roi: res.totalDeposited>0 ? (res.finalEquity-res.totalDeposited)/res.totalDeposited : 0 }));
  if(rows.length===1){
    const r=rows[0];
    SharedVerdict.set(el, { tone:'', title: nm(r.name)+' turned '+num(fmt.currency(r.dep))+' of top-ups into '+num(fmt.currency(r.fin))+'.',
      body: 'A return on investment (ROI) of '+num(fmt.pct(r.roi))+' over the run. Add a scenario to compare it against.' });
    return;
  }
  const deps=rows.map(r=>r.dep), hi=Math.max(...deps), lo=Math.min(...deps);
  const sameMoney = hi-lo <= Math.max(1, hi*0.005);
  if(sameMoney){
    const sorted=rows.slice().sort((a,b)=>b.fin-a.fin), a=sorted[0], b=sorted[1];
    const gap=a.fin-b.fin;
    const others=rows.length>2 ? ' of the '+rows.length : '';
    SharedVerdict.set(el, { tone:'',
      title: gap<0.5
        ? nm(a.name)+' and '+nm(b.name)+' ended level at '+num(fmt.currency(a.fin))+'.'
        : nm(a.name)+' ended highest'+others+' at '+num(fmt.currency(a.fin))+', '+num(fmt.currency(gap))+' more than '+nm(b.name)+'.',
      body: 'Every scenario topped up about '+num(fmt.currency(hi))+', so their final values compare directly. '+
            'Advanced metrics, under the summary, add the risk taken to get there.' });
    return;
  }
  const sorted=rows.slice().sort((a,b)=>b.roi-a.roi), a=sorted[0], b=sorted[1];
  SharedVerdict.set(el, { tone:'',
    title: nm(a.name)+' earned the most on what went in: a return on investment (ROI) of '+num(fmt.pct(a.roi))+', against '+num(fmt.pct(b.roi))+' for '+nm(b.name)+'.',
    body: 'The scenarios topped up different amounts, from '+num(fmt.currency(lo))+' to '+num(fmt.currency(hi))+
          ', so this compares the return on the money each put in rather than the final value.' });
}

/* ─── WHAT THIS ASSUMES ───
   Built from the run on screen: the assets, rules and figures the scenarios
   actually used. A feature none of them touched (a simulated asset, a
   hindsight rule, the advanced metrics) says nothing. */
function renderAssumptions(){
  const el=$('assumptions'); if(!el) return;
  const nm=t=>'<span data-no-abbr>'+escapeHtml(t)+'</span>';
  const list=a=>a.length<2 ? a.join('') : a.slice(0,-1).join(', ')+' and '+a[a.length-1];
  const pc=v=>(+(Number(v)||0).toFixed(2))+'%';
  // A sweep says what it varied first; the lines below then describe what stayed
  // fixed, so a line about a swept setting is left to it.
  const runs=optResult ? [optResult.S0] : simResults.length ? simResults.map(r=>r.sec) : securities;
  const items=optResult ? optAssumptionLines() : [];
  const swept=new Set(optResult ? optResult.vars.map(v=>v.key) : []);
  if(!runs.length){ el.innerHTML='<li><strong>Add a scenario and simulate</strong> to see what the run rests on.</li>'; return; }

  const tickers=[...new Set(runs.filter(s=>s.type==='ticker').map(s=>String(s.ticker||'').toUpperCase()).filter(Boolean))];
  if(tickers.length){
    const stooq=tickers.filter(t=>{ const e=priceCache[t]; return e && e.kind==='stock' && e.source==='stooq'; });
    const adj=tickers.filter(t=>!stooq.includes(t));
    if(adj.length) items.push('<strong>'+list(adj.map(nm))+(adj.length===1?' uses':' use')+' Yahoo Finance\'s adjusted close,</strong> so dividends and splits are folded into the price.');
    if(stooq.length) items.push('<strong>'+list(stooq.map(nm))+(stooq.length===1?' is':' are')+' from Stooq and unadjusted,</strong> so dividends are left out of the return.');
    if(currentCurrencySymbol!=='$' || tickers.some(t=>t.includes('.')))
      items.push('<strong>'+escapeHtml(currentCurrencySymbol||'The currency')+' is a label.</strong> Nothing is converted, so each ticker is read in the currency it is quoted in.');
  }
  const sims=runs.filter(s=>s.type==='custom');
  if(sims.length){
    const seen=new Set();
    const desc=sims.filter(s=>{ const k=s.name+'|'+s.returnPct+'|'+s.stdPct; if(seen.has(k)) return false; seen.add(k); return true; })
      .map(s=>nm(s.name)+' at '+pc(s.returnPct)+' a year, '+pc(s.stdPct)+' standard deviation');
    items.push('<strong>'+(desc.length===1?'The simulated asset is one random path:':'Each simulated asset is one random path:')+'</strong> '+desc.join('; ')+
      '. Seed '+escapeHtml(String(currentRandomSeed))+' fixes it, so it is a what-if rather than a forecast.');
  }

  if(simResults.length){
    const axis=simResults[0].dailyRows;
    if(axis.length) items.push('<strong>'+(optResult ? 'Every run covers ' : 'Every scenario runs ')+escapeHtml(axis[0].date)+' to '+escapeHtml(axis[axis.length-1].date)+'</strong>'+
      (runs.length>1 ? ', the trading days all of their assets share.' : '.'));
  }

  const FILL={ 'close':'that day\'s close', 'next-open':'the next day\'s open', 'next-close':'the next day\'s close' };
  items.push('<strong>Every rule decides on a day\'s close and fills at '+escapeHtml(FILL[currentExecTiming]||FILL['next-open'])+'.</strong>');

  // A swept amount (or a swept frequency, which the amount follows) is named in
  // the sweep's own line above, so this one leaves the figure out.
  const amtSwept=swept.has('amount') || swept.has('period');
  const amounts=amtSwept ? [] : [...new Set(runs.map(s=>fmt.currency(s.amount)))];
  const rises=swept.has('yearlyIncrease') ? [] : [...new Set(runs.map(s=>Number(s.yearlyIncrease)||0).filter(v=>v))];
  items.push('<strong>No fees and no tax:</strong> each '+(amounts.length ? list(amounts)+' ' : '')+'top-up buys its whole amount, in fractions of a unit where needed'+
    (rises.length ? ', rising '+list(rises.map(pc))+' a year' : '')+'.');

  const signal=swept.has('eom') ? [] : runs.filter(s=>MOMENTUM_STYLES.includes(s.style)||TECH_STYLES.includes(s.style));
  if(signal.length){
    const eom=s=>MOMENTUM_STYLES.includes(s.style)?s.momentumEOM:s.techEOM;
    const on=signal.filter(eom), off=signal.filter(s=>!eom(s));
    const word=s=>(swept.has('period') ? 'period' : s.period==='weekly'?'week':'month');
    if(on.length) items.push('<strong>'+list(on.map(s=>nm(s.name)))+' still '+(on.length===1?'buys':'buy')+' at the end of a '+word(on[0])+' with no signal.</strong>');
    if(off.length) items.push('<strong>'+list(off.map(s=>nm(s.name)))+' '+(off.length===1?'skips':'skip')+' a '+word(off[0])+' with no signal,</strong> so less money goes in.');
  }
  const fwd=runs.filter(s=>FORWARD_STYLES.includes(s.style));
  if(fwd.length) items.push('<strong>'+list([...new Set(fwd.map(s=>styleLabel(s.style)))])+' '+(fwd.length===1?'uses':'use')+' hindsight.</strong> '+
    'The buy day is picked with prices from later in the period, so it is a benchmark, not a plan anyone could follow.');

  if(showAdvanced) items.push('<strong>The '+pc(currentRiskFreeRate)+' risk-free rate only feeds Sharpe and Sortino.</strong> It changes no money anywhere on the page.');

  el.innerHTML=items.map(t=>'<li>'+t+'</li>').join('');
}

// Render one labelled endpoint row (start-of-simulation / end-of-simulation) from
// a daily snapshot. These bracket the per-investment rows so the table opens at the
// very first trading day and closes at the very last, even when neither is a buy day.
function endpointRowHtml(d, label){
  const ret=d.totalDeposited>0?(d.equity-d.totalDeposited)/d.totalDeposited:0;
  const color=ret>=0?'var(--positive-em)':'var(--negative-em)';
  return `<tr class="detail-endpoint">
    <td>${d.date}<span class="detail-row-tag">${label}</span></td>
    <td>—</td>
    <td>${fmt.currency(d.price)}</td>
    <td>—</td>
    <td>—</td>
    <td>${d.totalUnits.toFixed(6)}</td>
    <td>${fmt.currency(d.totalDeposited)}</td>
    <td>${fmt.currency(d.equity)}</td>
    <td style="color:${color}">${fmt.pct(ret)}</td>
  </tr>`;
}

function renderDetailTable(idx){
  const res=simResults[idx];
  if(!res) return;
  const note=$('detailUnitNote');
  if(note) note.textContent=(currentCurrencySymbol ? 'Amounts in '+currentCurrencySymbol+'.' : 'Amounts in the currency of the prices.')+
    ' One row per buy, between the first and the last trading day.';
  const tbody=$('detailBody');
  if(!res.investRows.length){ tbody.innerHTML='<tr><td colspan="9" style="color:var(--muted);text-align:center;padding:20px">No investment dates in range.</td></tr>'; return; }
  const daily=res.dailyRows;
  const first=daily[0], last=daily[daily.length-1];
  let html='';
  // Beginning (start-of-simulation) row, unless the first buy already lands on it.
  if(first && first.date!==res.investRows[0].date) html+=endpointRowHtml(first,'start');
  res.investRows.forEach(r=>{
    const color=r.returnPct>=0?'var(--positive-em)':'var(--negative-em)';
    html+=`<tr>
      <td>${r.date}</td>
      <td>${r.signalDate}</td>
      <td>${fmt.currency(r.price)}</td>
      <td>${fmt.currency(r.amountInvested)}</td>
      <td>${r.unitsAdded.toFixed(6)}</td>
      <td>${r.totalUnits.toFixed(6)}</td>
      <td>${fmt.currency(r.totalDeposited)}</td>
      <td>${fmt.currency(r.equity)}</td>
      <td style="color:${color}">${fmt.pct(r.returnPct/100)}</td>
    </tr>`;
  });
  // Final (end-of-simulation) row, unless the last buy already lands on it.
  if(last && last.date!==res.investRows[res.investRows.length-1].date) html+=endpointRowHtml(last,'final');
  tbody.innerHTML=html;
}

/* ─── THEME TOGGLE ─── */
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
  if(simResults.length){ updatePriceChart(); updateEquityChart(); renderSummary(); }
  if(optResult) updateOptChart();
  renderSecList();
});

/* ─── SIMULATE BUTTON ─── */
$('simBtn').addEventListener('click', runSimulation);

/* Every control in the sidebar feeds the engine, so any edit sends the results
   out of date - including the fields the scenario editor mints on the fly.
   The exceptions carry data-no-stale: they change how an existing run is READ
   (currency symbol, the risk-free rate behind the advanced metrics) or what it
   is CALLED, and are re-rendered in place instead. Capture phase, so a field
   that stops its own event from bubbling is still counted. */
{
  const panel=document.querySelector('aside.controls');
  if(panel) ['input','change'].forEach(ev=>panel.addEventListener(ev, e=>{
    const t=e.target;
    if(!t || !t.matches || !t.matches('input,select,textarea')) return;
    if(t.closest('[data-no-stale]')) return;
    markStale();
  }, true));
}

/* ─── WORKSPACE RESET ─── */
/* There is no Reset button. A Quick Start already clears the workspace and
   lays a worked example over it, which is a better place to land than the
   generic default, and the downloaded prices are cleared by Clear all on the
   Data tab — the two jobs the one button used to do, each where it belongs.
   Everything below is the first of those jobs: the settings and the view a
   scenario does not set itself, back to their defaults. The price cache is
   deliberately left alone, so switching examples costs no re-download. */
function resetWorkspace(){
  securities=[]; simResults=[]; latestRows=[];
  optAbort=true; optVars=[]; optResult=null; optPick=[0,0]; optPickWanted=null;
  closeOptModal(); $('optMetric').value='roi'; setBoardMode(); syncOptUi();
  markFresh();   // nothing on the board to be out of date
  secIdCounter=0; activeSecurityId=null;
  currentCurrencySymbol='$';
  currentRandomSeed=DEFAULT_RANDOM_SEED;
  currentRiskFreeRate=DEFAULT_RISK_FREE_RATE;
  // Reset price-chart view state (candles off, "first only" default restored).
  showCandles=false; priceHidden=new Set(); priceSeriesCount=-1;
  { const ct=$('showCandleToggle'); if(ct) ct.checked=false; }
  if(priceChartInstance){ priceChartInstance.destroy(); priceChartInstance=null; }
  if(equityChartInstance){ equityChartInstance.destroy(); equityChartInstance=null; }
  $('summaryGrid').innerHTML='';
  renderVerdict();
  $('detailBody').innerHTML='<tr><td colspan="9" style="color:var(--muted);text-align:center;padding:20px">Add securities to see detailed data.</td></tr>';
  $('detailSelect').innerHTML='';
  activeDetailSec=0;
  $('priceLegend').innerHTML=''; $('equityLegend').innerHTML='';
  $('priceHoverBox').textContent='Add securities and run to view price data.';
  $('equityHoverBox').textContent='Add securities and run to view equity data.';
  $('currencySymbol').value='$';
  $('randomSeed').value=DEFAULT_RANDOM_SEED;
  $('riskFreeRate').value=DEFAULT_RISK_FREE_RATE;
  $('execTiming').value=DEFAULT_EXEC_TIMING; currentExecTiming=DEFAULT_EXEC_TIMING;
  hideStatus($('fetchStatus')); hideStatus($('dateRangeStatus')); hideWarning();
  setPoolLocked(false); hideStatus($('poolStatus')); setDataMode('real');
}

/* ─── QUICK START PRESETS ─── */
// One-click worked examples. Each rebuilds the securities list with live-ticker
// securities, then runs the simulation so real Yahoo Finance prices are fetched
// (no simulated/custom data). Ideas: schedule, asset class, and instrument type.
const QUICK_START_PRESETS = {
  'monthly-weekly':[
    {type:'ticker', ticker:'SPY', name:'SPY - $520 / month', amount:520, style:'monthly-date', dayOrDate:1},
    {type:'ticker', ticker:'SPY', name:'SPY - $120 / week',  amount:120, style:'weekly-day',  dayOrDate:1},
  ],
  'equity-mmf':[
    {type:'ticker', ticker:'DHHF.AX', name:'DHHF.AX - Equity ETF',       amount:500, style:'monthly-date', dayOrDate:1},
    {type:'ticker', ticker:'AAA.AX',  name:'AAA.AX - Money Market Fund', amount:500, style:'monthly-date', dayOrDate:1},
  ],
  'stock-etf':[
    {type:'ticker', ticker:'AAPL', name:'AAPL - Individual Stock', amount:500, style:'monthly-date', dayOrDate:1},
    {type:'ticker', ticker:'SPY',  name:'SPY - ETF',               amount:500, style:'monthly-date', dayOrDate:1},
  ],
};

async function applyQuickStart(key){
  const defs = QUICK_START_PRESETS[key];
  if(!defs) return;
  // A clean workspace first, so an example never inherits the currency, seed or
  // chart view the last one was read under, then the preset over the top.
  resetWorkspace();
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
/* Exports are drawn from the chart at its desktop size, whatever the screen
   (SharedExport in shared.js), so a phone exports the same picture a laptop does. */
function downloadChartPng(canvasId){
  var args = arguments;
  return SharedExport.atDesktopSize(canvasId, function(){ return downloadChartPngAtSize.apply(null, args); });
}
function downloadChartPngAtSize(canvasId, filename, chartTitle, legendId, shouldDownload = true) {
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

  // Visible legend entries, each with the mark it is drawn with, so the
  // exported key matches the page's key line for line.
  const legendItems = legendId ? SharedLegend.itemsOf(legendId) : [];

  const titleFontPx = Math.round(14 * OUT);
  const legendFontPx = Math.round(11 * OUT);
  const titleH = chartTitle ? Math.round(40 * OUT) : 0;
  // The key is packed into as many rows as it needs, and the watermark gets a
  // strip of its own: on one assumed row a wide key ran off the canvas, and
  // straight through the watermark on its way out.
  const markW = SharedLegend.W * OUT, legGap = Math.round(7 * OUT), legPad = Math.round(20 * OUT);
  const legMargin = Math.round(16 * OUT), legRowH = Math.round(22 * OUT);
  const wmH = Math.round(26 * OUT);
  const measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `500 ${legendFontPx}px ${FONT}`;
  const legendRows = legendItems.length
    ? SharedLegend.layout(legendItems, s => measureCtx.measureText(s).width,
                          chartW - legMargin * 2, markW, legGap, legPad)
    : [];
  const legendH = legendRows.length ? legendRows.length * legRowH + Math.round(8 * OUT) : 0;

  const tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH + wmH;
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

  if(legendRows.length){
    ctx.font = `500 ${legendFontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    const ly = titleH + chartH + Math.round(4 * OUT);
    legendRows.forEach((row, ri) => {
      let x = Math.max(legMargin, (tmp.width - row.width) / 2);
      const cy = ly + legRowH * ri + legRowH / 2;
      row.items.forEach(item => {
        SharedLegend.paint(ctx, item.swatch || {color:item.color}, x, cy, OUT);
        x += markW + legGap;
        ctx.fillStyle = fgColor;
        ctx.textAlign = 'left';
        ctx.fillText(item.label, x, cy);
        x += ctx.measureText(item.label).width + legPad;
      });
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

/* Exports are drawn from the chart at its desktop size, whatever the screen
   (SharedExport in shared.js), so a phone exports the same picture a laptop does. */
function downloadChartSvg(canvasId){
  var args = arguments;
  return SharedExport.atDesktopSize(canvasId, function(){ return downloadChartSvgAtSize.apply(null, args); });
}
function downloadChartSvgAtSize(canvasId, filename, chartTitle, legendId, legendItemsOverride) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const legendItems = legendItemsOverride ? legendItemsOverride.slice()
    : (legendId ? SharedLegend.itemsOf(legendId) : []);
  const titleH = chartTitle ? 40 : 0;
  // Same packing as the PNG, and the same strip kept clear for the watermark.
  const markW = SharedLegend.W, legGap = 7, legPad = 20, legMargin = 16, legRowH = 22, wmH = 26;
  const legMeasure = document.createElement('canvas').getContext('2d');
  legMeasure.font = '500 11px DM Sans, sans-serif';
  const legendRows = legendItems.length
    ? SharedLegend.layout(legendItems, s => legMeasure.measureText(s).width,
                          chartW - legMargin * 2, markW, legGap, legPad)
    : [];
  const legendH = legendRows.length ? legendRows.length * legRowH + 8 : 0;
  const svgW = chartW, svgH = chartH + titleH + legendH + wmH;
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
  // Plain href first: SVG 2 viewers (and some converters) ignore xlink:href,
  // which left the chart blank with only the title, legend and logo showing.
  const chartHref = src.toDataURL('image/png');
  img.setAttribute('href',chartHref); img.setAttributeNS(xl,'href',chartHref);
  svg.appendChild(img);
  legendRows.forEach((row, ri) => {
    let x = Math.max(legMargin, (svgW - row.width) / 2);
    const cy = titleH + chartH + 4 + legRowH * ri + legRowH / 2;
    row.items.forEach(item => {
      svg.appendChild(SharedLegend.svgNode(item.swatch || {color:item.color}, x, cy, 1));
      x += markW + legGap;
      const lt = document.createElementNS(NS,'text');
      lt.setAttribute('x',x); lt.setAttribute('y',cy);
      lt.setAttribute('dominant-baseline','middle'); lt.setAttribute('font-family',FONT);
      lt.setAttribute('font-size','11'); lt.setAttribute('font-weight','500'); lt.setAttribute('fill',fgColor);
      lt.textContent = item.label; svg.appendChild(lt);
      x += legMeasure.measureText(item.label).width + legPad;
    });
  });
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
  return 'DCA Scenario Explorer: Security Prices'+note;
}
$('pricePngBtn').addEventListener('click', () => downloadChartPng('priceCanvas', 'dca_price_chart.png', priceChartExportTitle(), 'priceLegend'));
$('priceCopyPngBtn').addEventListener('click', () => {
  SharedShare.copyImage(() => downloadChartPng('priceCanvas', 'dca_price_chart.png', priceChartExportTitle(), 'priceLegend', false), $('priceCopyPngBtn'));
});
$('equityPngBtn').addEventListener('click', () => downloadChartPng('equityCanvas', 'dca_portfolio_chart.png', 'DCA Scenario Explorer: Portfolio Value', 'equityLegend'));
$('equityCopyPngBtn').addEventListener('click', () => {
  SharedShare.copyImage(() => downloadChartPng('equityCanvas', 'dca_portfolio_chart.png', 'DCA Scenario Explorer: Portfolio Value', 'equityLegend', false), $('equityCopyPngBtn'));
});
$('priceSvgBtn').addEventListener('click', () => downloadChartSvg('priceCanvas', 'dca_price_chart.svg', priceChartExportTitle(), 'priceLegend'));
$('equitySvgBtn').addEventListener('click', () => downloadChartSvg('equityCanvas', 'dca_portfolio_chart.svg', 'DCA Scenario Explorer: Portfolio Value', 'equityLegend'));
/* The optimisation card holds a line (Chart.js) or, for two settings, a surface
   (Plotly), so its buttons ask which is on the board. */
$('optPngBtn').addEventListener('click', () => {
  if(surfaceOnBoard()) return withSurfaceMarks(() => Plotly.downloadImage('optSurface', Object.assign({format:'png', filename:'dca_optimisation', scale:3}, OPT_SURFACE_EXPORT_SIZE)));
  downloadChartPng('optCanvas', 'dca_optimisation.png', optChartTitle(), 'optLegend');
});
$('optCopyBtn').addEventListener('click', () => {
  if(surfaceOnBoard()) return SharedShare.copyImage(() => withSurfaceMarks(() => Plotly.toImage('optSurface', Object.assign({format:'png', scale:3}, OPT_SURFACE_EXPORT_SIZE))), $('optCopyBtn'));
  SharedShare.copyImage(() => downloadChartPng('optCanvas', 'dca_optimisation.png', optChartTitle(), 'optLegend', false), $('optCopyBtn'));
});
$('optSvgBtn').addEventListener('click', () => {
  if(surfaceOnBoard()) return withSurfaceMarks(() => Plotly.downloadImage('optSurface', Object.assign({format:'svg', filename:'dca_optimisation'}, OPT_SURFACE_EXPORT_SIZE)));
  downloadChartSvg('optCanvas', 'dca_optimisation.svg', optChartTitle(), 'optLegend');
});
$('optResetZoom').addEventListener('click', () => {
  // The surface has no zoom to undo, but it has a camera to put back.
  if(surfaceOnBoard()){ Plotly.relayout('optSurface', {'scene.camera':OPT_CAMERA}); return; }
  if(optChart) optChart.resetZoom();
});
$('optCanvas').addEventListener('mouseleave', () => { $('optHoverBox').textContent='Hover to read each tested value, click one to show it below.'; });
// What the sweep is ranked by is a view of it, so it redraws without a run.
$('optMetric').addEventListener('change', () => { if(!optResult) return; updateOptChart(); renderSummary(); renderVerdict(); if(persist) persist.schedule(); });

/* ─── DOWNLOAD CSV (Detailed Breakdown of active tab) ─── */
$('detailSelect').addEventListener('change',e=>{
  activeDetailSec=parseInt(e.target.value,10)||0;
  renderDetailTable(activeDetailSec);
});

$('downloadBtn').addEventListener('click',()=>{
  if(!simResults.length){ showWarning('Run simulation first.'); return; }
  const idx=activeDetailSec<simResults.length?activeDetailSec:0;
  const res=simResults[idx]; if(!res) return;
  // The same rows the table shows: the first and last day bracket the buys, so
  // the file ends on the final equity the summary reports.
  const headers=['Date','Row','Decided','Price','Amount_Invested','Units_Added','Total_Units','Total_Deposited','Equity','Return_Pct'];
  const endRow=(d,tag)=>[d.date,tag,'',d.price.toFixed(4),'','',d.totalUnits.toFixed(6),d.totalDeposited.toFixed(2),d.equity.toFixed(2),
    (d.totalDeposited>0?(d.equity-d.totalDeposited)/d.totalDeposited*100:0).toFixed(2)].join(',');
  const daily=res.dailyRows, first=daily[0], last=daily[daily.length-1];
  const buys=res.investRows;
  const lines=buys.map(r=>[r.date,'buy',r.signalDate,r.price.toFixed(4),r.amountInvested.toFixed(2),
    r.unitsAdded.toFixed(6),r.totalUnits.toFixed(6),r.totalDeposited.toFixed(2),r.equity.toFixed(2),r.returnPct.toFixed(2)].join(','));
  if(first && (!buys.length || first.date!==buys[0].date)) lines.unshift(endRow(first,'start'));
  if(last && (!buys.length || last.date!==buys[buys.length-1].date)) lines.push(endRow(last,'final'));
  const csv='# Made using tool.adjiebrotots.com/dcasimulator\n'+[headers.join(','),...lines].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`dca_${res.sec.name.replace(/[^a-z0-9]/gi,'_')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
});

/* ─── SAVE / LOAD SETTINGS (download/upload the whole configuration as JSON) ───
   Lets a user persist every scenario + the global settings and resume later
   instead of re-entering them. Price history is NOT saved (it lives in the
   shared cache and is re-fetched on the next run); only the configuration is. */
function buildSettingsObj(){
  const securitiesOut = securities.map(s=>{
    const c = JSON.parse(JSON.stringify(s));
    delete c.priceData; delete c.loaded; delete c.open;  // transient/cache fields
    return c;
  });
  return {
    app:'dca-single', version:1, savedAt:new Date().toISOString(),
    global:{
      currencySymbol: currentCurrencySymbol,
      randomSeed: currentRandomSeed,
      riskFreeRate: currentRiskFreeRate,
      execTiming: currentExecTiming,
      startDate: $('startDate').value,
      endDate: $('endDate').value,
      tickerPool: ($('tickerPoolInput')||{}).value || '',
      simPool: JSON.parse(JSON.stringify(simPool))
    },
    securities: securitiesOut,
    // Optimise mode rides along only while it is on, so a file without it (every
    // file saved before it existed) opens comparing scenarios, as it always did.
    ...(optVars.length ? { optimise:{ scenario:Math.max(0, securities.findIndex(s=>s.id===activeSecurityId)),
      vars:optVars.map(v=>Object.assign({}, v)), metric:optMetricKey(), pick:optPick.slice(0, optVars.length) } } : {})
  };
}
// The swept settings a file or link carries. Anything unreadable is dropped
// rather than guessed at; a setting the scenario no longer offers is dropped
// later, by pruneOptVars, once the scenario is loaded, which also keeps the
// first two that still apply.
function readOptVars(o){
  if(!o || !Array.isArray(o.vars)) return [];
  const seen=new Set(), out=[];
  o.vars.forEach(v=>{
    if(!v || typeof v.key!=='string' || seen.has(v.key) || out.length>=8) return;
    seen.add(v.key);
    const r={ key:v.key, start:v.start, end:v.end, steps:optClamp(parseInt(v.steps,10)||11, 2, OPT_MAX_STEPS) };
    if(Array.isArray(v.pick)) r.pick=v.pick.filter(x=>typeof x==='string' || typeof x==='number').slice(0, OPT_MAX_STEPS);
    out.push(r);
  });
  return out;
}
function importSettings(obj){
  if(!obj || obj.app!=='dca-single'){
    showWarning('That file is not a DCA Simulator settings file.'); return;
  }
  const g = obj.global || {};
  if(g.currencySymbol){ $('currencySymbol').value=g.currencySymbol; currentCurrencySymbol=g.currencySymbol; const pfx=$('cfgAmountPrefix'); if(pfx) pfx.textContent=currentCurrencySymbol||'$'; }
  if(g.randomSeed!=null){ $('randomSeed').value=g.randomSeed; currentRandomSeed=sanitizeSeed(g.randomSeed); }
  if(g.riskFreeRate!=null){ $('riskFreeRate').value=g.riskFreeRate; const n=parseFloat(g.riskFreeRate); currentRiskFreeRate=Number.isFinite(n)?Math.max(0,n):0; }
  // A file saved before Trade at existed filled at the close, which is what it
  // said then; it reopens on the default, the setting it would get today.
  currentExecTiming = SharedTA.EXEC_MODES.includes(g.execTiming) ? g.execTiming : DEFAULT_EXEC_TIMING;
  $('execTiming').value=currentExecTiming;
  if(g.startDate) $('startDate').value=g.startDate;
  if(g.endDate) $('endDate').value=g.endDate;
  if(g.tickerPool!=null){ const inp=$('tickerPoolInput'); if(inp) inp.value=g.tickerPool; }
  if(Array.isArray(g.simPool)){ simPool=g.simPool.filter(x=>x&&x.name).map(x=>({name:x.name, returnPct:Number(x.returnPct)||0, stdPct:Math.max(0,Number(x.stdPct)||0)})); persistSimPool(); renderPoolChips(); }
  // Rebuild the scenario list from the file (prices re-fetch on run; the cache
  // makes that free for tickers already loaded).
  securities=[]; simResults=[]; latestRows=[]; secIdCounter=0; activeSecurityId=null;
  // Cleared before the scenarios go back in, so nothing is pruned against a
  // half-built list; the sweep is read once its scenario is active.
  optVars=[]; optResult=null; setBoardMode(); closeOptModal();
  markFresh();
  hideWarning();
  (obj.securities||[]).forEach(s=>addSecurity(s));
  const o=obj.optimise;
  if(o){
    const at=parseInt(o.scenario,10);
    if(Number.isInteger(at) && at>=0 && at<securities.length) activeSecurityId=securities[at].id;
    optVars=readOptVars(o);
    optPickWanted=Array.isArray(o.pick) ? o.pick.map(n=>parseInt(n,10)) : null;
    if(OPT_METRICS[o.metric]) $('optMetric').value=o.metric;
  } else optPickWanted=null;
  document.querySelectorAll('.quick-start-btn').forEach(b=>b.classList.remove('active'));
  renderSecList();
  // Returned, so an embedded chart (SharedShare) waits for the prices.
  return runSimulation();
}
// The file keeps its own 'dca-single' format, so files saved before the
// buttons moved to the Quick Start row still open.
SharedScenario.mount('.quick-start-row', {
  tool:'dcasimulator', filename:'dca-simulator-settings.json',
  save: buildSettingsObj, load: importSettings,
  onError: msg=>showWarning(msg)
});
// An embedded chart never calls the Worker (shared.js), so the prices the
// scenario draws ride in its link and go into the frame's cache first.
SharedShare.data({
  save: ()=>SharedYF.snapCache(priceCache,
    securities.filter(s=>s.type==='ticker').map(s=>s.ticker), $('startDate').value, $('endDate').value),
  load: d=>{ SharedYF.restoreCache(priceCache, d); }
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
  ensureSimEntry('S&P500',10,18);
  ensureSimEntry('Risk-Free 5%',5,0.5);
  addSecurity({type:'custom',name:'S&P500',simName:'S&P500',returnPct:10,stdPct:18,amount:500,style:'monthly-date',dayOrDate:1});
  addSecurity({type:'custom',name:'Risk-Free 5%',simName:'Risk-Free 5%',returnPct:5,stdPct:0.5,amount:500,style:'monthly-date',dayOrDate:1});
  renderPoolChips();
}

/* The breakdown table is the most specific thing on the page, so it opens
   closed behind its chevron; the CSV button exports it either way. */
if(window.SharedFold) SharedFold.attach(document.querySelector('main .detail-section'),
  { key:'dcasimulator', bodies:['#detailUnitNote','.table-wrap'] });
renderAssumptions();

// Restore any previously cached price history so reloads/return visits cost
// zero Worker requests, then reflect it in the pool UI.
loadPersistedCache();
loadPersistedSimPool();
renderPoolChips();
refreshTickerSelect();
updateRateInfo();
updateBtnRow();

/* The tour's results step describes the Final Summary and the charts, so
   make sure there is something to describe: run the simulation if nothing
   has been run yet. It only computes from the scenarios already on screen,
   so there is no user input to save or restore here. */
window.__DCA_TOUR = {
  ensureResults: function(){
    const grid=$('summaryGrid');
    if(grid && grid.children.length) return;  // already showing results
    if(simBlockReason()) return;              // can't run; don't claim we did
    runSimulation();
  }
};

/* ── Mini cache ──────────────────────────────────────────────────────────
   Restore the user's last scenario set + global settings (built with the same
   shape as the export/import config) so a returning user resumes where they
   left off. If there's no saved config, seed the default securities instead.
   Price history is not cached here — it lives in the shared price cache and
   re-fetches for free for tickers already loaded. */
let restoredFromCache = false;
persist = Persist.init('dcasimulator', {
  onRestore: function(){ /* importSettings() already rebuilt securities and ran the sim */ },
  extra: {
    save: buildSettingsObj,
    restore: function(e){ if(e && e.app === 'dca-single'){ try { importSettings(e); restoredFromCache = true; } catch(_){ restoredFromCache = false; } } }
  }
});
if(!restoredFromCache){
  initializeDefaultSecurities();
  runSimulation();
}

})();
