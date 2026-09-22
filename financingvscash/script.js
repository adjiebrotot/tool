(function(){
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG/chart exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
// Watermark wordmark ("Made using tool.adjiebrotots.com/financingvscash") baked to DM Sans 500 glyph
// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.
const WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM180.42 0V-6.29Q180.42 -6.87 180.62 -7.23Q180.81 -7.58 181.18 -7.75Q181.56 -7.92 182.09 -7.92H182.86V-6.98H182.26Q181.86 -6.98 181.69 -6.82Q181.52 -6.66 181.52 -6.27V0ZM179.57 -4.76V-5.69H182.94V-4.76ZM184.16 0V-5.69H185.26V0ZM184.72 -6.69Q184.4 -6.69 184.2 -6.89Q183.99 -7.09 183.99 -7.39Q183.99 -7.69 184.2 -7.88Q184.4 -8.07 184.72 -8.07Q185.02 -8.07 185.23 -7.88Q185.44 -7.69 185.44 -7.39Q185.44 -7.09 185.23 -6.89Q185.02 -6.69 184.72 -6.69ZM186.86 0V-5.69H187.85L187.91 -4.77Q188.17 -5.26 188.64 -5.54Q189.12 -5.82 189.76 -5.82Q190.41 -5.82 190.88 -5.56Q191.35 -5.31 191.61 -4.79Q191.87 -4.28 191.87 -3.51V0H190.78V-3.4Q190.78 -4.13 190.43 -4.51Q190.08 -4.88 189.46 -4.88Q189.04 -4.88 188.7 -4.69Q188.36 -4.49 188.16 -4.12Q187.96 -3.74 187.96 -3.2V0ZM195.19 0.13Q194.52 0.13 194.07 -0.11Q193.63 -0.35 193.41 -0.75Q193.19 -1.15 193.19 -1.62Q193.19 -2.17 193.47 -2.56Q193.75 -2.96 194.28 -3.17Q194.81 -3.38 195.54 -3.38H196.96Q196.96 -3.89 196.83 -4.23Q196.71 -4.57 196.43 -4.74Q196.15 -4.9 195.7 -4.9Q195.22 -4.9 194.89 -4.68Q194.55 -4.45 194.47 -4H193.37Q193.43 -4.58 193.76 -4.98Q194.08 -5.39 194.59 -5.6Q195.11 -5.82 195.7 -5.82Q196.48 -5.82 197.01 -5.54Q197.53 -5.27 197.8 -4.77Q198.06 -4.27 198.06 -3.58V0H197.1L197.01 -0.94Q196.9 -0.72 196.73 -0.52Q196.56 -0.33 196.33 -0.18Q196.11 -0.03 195.82 0.05Q195.53 0.13 195.19 0.13ZM195.39 -0.76Q195.73 -0.76 196.01 -0.91Q196.3 -1.05 196.5 -1.31Q196.71 -1.56 196.82 -1.87Q196.93 -2.19 196.94 -2.54V-2.6H195.65Q195.18 -2.6 194.89 -2.49Q194.6 -2.37 194.48 -2.16Q194.35 -1.95 194.35 -1.69Q194.35 -1.4 194.47 -1.2Q194.59 -0.99 194.83 -0.88Q195.06 -0.76 195.39 -0.76ZM199.55 0V-5.69H200.53L200.6 -4.77Q200.85 -5.26 201.33 -5.54Q201.8 -5.82 202.44 -5.82Q203.09 -5.82 203.56 -5.56Q204.04 -5.31 204.3 -4.79Q204.56 -4.28 204.56 -3.51V0H203.46V-3.4Q203.46 -4.13 203.11 -4.51Q202.76 -4.88 202.14 -4.88Q201.73 -4.88 201.39 -4.69Q201.05 -4.49 200.85 -4.12Q200.65 -3.74 200.65 -3.2V0ZM208.6 0.13Q207.8 0.13 207.17 -0.24Q206.54 -0.62 206.19 -1.29Q205.83 -1.95 205.83 -2.83Q205.83 -3.73 206.19 -4.4Q206.54 -5.07 207.17 -5.44Q207.8 -5.82 208.6 -5.82Q209.62 -5.82 210.3 -5.28Q210.98 -4.75 211.17 -3.83H210.03Q209.92 -4.33 209.52 -4.6Q209.13 -4.88 208.59 -4.88Q208.13 -4.88 207.75 -4.64Q207.38 -4.41 207.17 -3.96Q206.96 -3.51 206.96 -2.84Q206.96 -2.35 207.08 -1.97Q207.2 -1.58 207.42 -1.32Q207.64 -1.07 207.94 -0.93Q208.24 -0.8 208.59 -0.8Q208.95 -0.8 209.25 -0.92Q209.54 -1.05 209.75 -1.29Q209.96 -1.53 210.03 -1.86H211.17Q210.99 -0.96 210.3 -0.41Q209.61 0.13 208.6 0.13ZM212.57 0V-5.69H213.67V0ZM213.12 -6.69Q212.8 -6.69 212.6 -6.89Q212.39 -7.09 212.39 -7.39Q212.39 -7.69 212.6 -7.88Q212.8 -8.07 213.12 -8.07Q213.43 -8.07 213.64 -7.88Q213.85 -7.69 213.85 -7.39Q213.85 -7.09 213.64 -6.89Q213.43 -6.69 213.12 -6.69ZM215.27 0V-5.69H216.25L216.32 -4.77Q216.57 -5.26 217.05 -5.54Q217.52 -5.82 218.16 -5.82Q218.81 -5.82 219.28 -5.56Q219.76 -5.31 220.02 -4.79Q220.28 -4.28 220.28 -3.51V0H219.18V-3.4Q219.18 -4.13 218.83 -4.51Q218.48 -4.88 217.86 -4.88Q217.45 -4.88 217.11 -4.69Q216.76 -4.49 216.57 -4.12Q216.37 -3.74 216.37 -3.2V0ZM224.05 2.55Q223.27 2.55 222.68 2.36Q222.09 2.17 221.77 1.77Q221.44 1.38 221.44 0.8Q221.44 0.49 221.58 0.18Q221.71 -0.13 222.01 -0.41Q222.31 -0.68 222.81 -0.9L223.46 -0.41Q222.88 -0.19 222.68 0.1Q222.48 0.4 222.48 0.69Q222.48 1.02 222.68 1.24Q222.88 1.46 223.23 1.57Q223.59 1.68 224.04 1.68Q224.49 1.68 224.82 1.56Q225.15 1.45 225.33 1.23Q225.5 1.01 225.5 0.72Q225.5 0.32 225.24 0.08Q224.97 -0.15 224.19 -0.19Q223.55 -0.24 223.11 -0.32Q222.66 -0.4 222.36 -0.5Q222.06 -0.61 221.85 -0.75Q221.65 -0.88 221.5 -1.02V-1.28L222.61 -2.39L223.54 -2.09L222.3 -0.99L222.53 -1.5Q222.65 -1.42 222.76 -1.35Q222.87 -1.28 223.06 -1.22Q223.25 -1.16 223.58 -1.11Q223.9 -1.06 224.44 -1.02Q225.2 -0.96 225.67 -0.76Q226.13 -0.55 226.35 -0.19Q226.56 0.17 226.56 0.68Q226.56 1.16 226.3 1.58Q226.03 2.01 225.48 2.28Q224.92 2.55 224.05 2.55ZM224.05 -1.75Q223.35 -1.75 222.85 -2.01Q222.36 -2.28 222.1 -2.75Q221.84 -3.21 221.84 -3.78Q221.84 -4.36 222.11 -4.81Q222.37 -5.27 222.86 -5.55Q223.35 -5.82 224.05 -5.82Q224.76 -5.82 225.25 -5.55Q225.73 -5.27 225.99 -4.81Q226.25 -4.36 226.25 -3.78Q226.25 -3.21 225.99 -2.75Q225.73 -2.28 225.25 -2.01Q224.76 -1.75 224.05 -1.75ZM224.05 -2.62Q224.6 -2.62 224.92 -2.91Q225.23 -3.2 225.23 -3.78Q225.23 -4.35 224.92 -4.64Q224.6 -4.93 224.05 -4.93Q223.51 -4.93 223.18 -4.64Q222.84 -4.35 222.84 -3.78Q222.84 -3.2 223.17 -2.91Q223.5 -2.62 224.05 -2.62ZM224.99 -4.82 224.73 -5.69H227V-4.94ZM229.73 0 227.59 -5.69H228.75L230.38 -1.05L232.02 -5.69H233.15L231.02 0ZM236.3 0.13Q235.54 0.13 235.01 -0.11Q234.49 -0.34 234.2 -0.77Q233.92 -1.19 233.86 -1.75H234.98Q235.02 -1.48 235.18 -1.26Q235.33 -1.03 235.61 -0.9Q235.89 -0.76 236.3 -0.76Q236.66 -0.76 236.9 -0.87Q237.14 -0.97 237.26 -1.16Q237.38 -1.34 237.38 -1.58Q237.38 -1.9 237.23 -2.07Q237.08 -2.25 236.79 -2.35Q236.5 -2.44 236.08 -2.5Q235.64 -2.58 235.26 -2.69Q234.89 -2.81 234.62 -3Q234.34 -3.19 234.2 -3.48Q234.05 -3.77 234.05 -4.17Q234.05 -4.65 234.31 -5.02Q234.56 -5.4 235.04 -5.61Q235.52 -5.82 236.17 -5.82Q237.13 -5.82 237.69 -5.38Q238.24 -4.95 238.34 -4.16H237.28Q237.22 -4.52 236.93 -4.72Q236.64 -4.92 236.16 -4.92Q235.66 -4.92 235.4 -4.74Q235.14 -4.55 235.14 -4.24Q235.14 -4.02 235.27 -3.85Q235.4 -3.68 235.68 -3.56Q235.97 -3.44 236.43 -3.37Q237.08 -3.27 237.54 -3.1Q238 -2.93 238.25 -2.59Q238.51 -2.26 238.5 -1.66Q238.5 -1.1 238.23 -0.7Q237.95 -0.3 237.46 -0.08Q236.97 0.13 236.3 0.13ZM242.39 0.13Q241.59 0.13 240.96 -0.24Q240.34 -0.62 239.98 -1.29Q239.62 -1.95 239.62 -2.83Q239.62 -3.73 239.98 -4.4Q240.34 -5.07 240.96 -5.44Q241.59 -5.82 242.39 -5.82Q243.41 -5.82 244.09 -5.28Q244.77 -4.75 244.96 -3.83H243.82Q243.71 -4.33 243.31 -4.6Q242.92 -4.88 242.38 -4.88Q241.92 -4.88 241.55 -4.64Q241.18 -4.41 240.96 -3.96Q240.75 -3.51 240.75 -2.84Q240.75 -2.35 240.87 -1.97Q240.99 -1.58 241.21 -1.32Q241.43 -1.07 241.73 -0.93Q242.03 -0.8 242.38 -0.8Q242.75 -0.8 243.04 -0.92Q243.34 -1.05 243.54 -1.29Q243.75 -1.53 243.82 -1.86H244.96Q244.78 -0.96 244.09 -0.41Q243.4 0.13 242.39 0.13ZM248.11 0.13Q247.44 0.13 246.99 -0.11Q246.55 -0.35 246.33 -0.75Q246.11 -1.15 246.11 -1.62Q246.11 -2.17 246.39 -2.56Q246.67 -2.96 247.2 -3.17Q247.73 -3.38 248.46 -3.38H249.88Q249.88 -3.89 249.76 -4.23Q249.63 -4.57 249.35 -4.74Q249.08 -4.9 248.62 -4.9Q248.14 -4.9 247.81 -4.68Q247.47 -4.45 247.39 -4H246.29Q246.36 -4.58 246.68 -4.98Q247 -5.39 247.51 -5.6Q248.03 -5.82 248.62 -5.82Q249.4 -5.82 249.93 -5.54Q250.45 -5.27 250.72 -4.77Q250.98 -4.27 250.98 -3.58V0H250.02L249.93 -0.94Q249.82 -0.72 249.65 -0.52Q249.48 -0.33 249.26 -0.18Q249.03 -0.03 248.74 0.05Q248.46 0.13 248.11 0.13ZM248.31 -0.76Q248.65 -0.76 248.93 -0.91Q249.22 -1.05 249.42 -1.31Q249.63 -1.56 249.74 -1.87Q249.85 -2.19 249.86 -2.54V-2.6H248.57Q248.11 -2.6 247.82 -2.49Q247.53 -2.37 247.4 -2.16Q247.27 -1.95 247.27 -1.69Q247.27 -1.4 247.39 -1.2Q247.51 -0.99 247.75 -0.88Q247.98 -0.76 248.31 -0.76ZM254.61 0.13Q253.84 0.13 253.32 -0.11Q252.79 -0.34 252.51 -0.77Q252.22 -1.19 252.17 -1.75H253.28Q253.33 -1.48 253.48 -1.26Q253.63 -1.03 253.91 -0.9Q254.19 -0.76 254.61 -0.76Q254.96 -0.76 255.2 -0.87Q255.44 -0.97 255.56 -1.16Q255.69 -1.34 255.69 -1.58Q255.69 -1.9 255.54 -2.07Q255.38 -2.25 255.1 -2.35Q254.81 -2.44 254.39 -2.5Q253.94 -2.58 253.57 -2.69Q253.19 -2.81 252.92 -3Q252.65 -3.19 252.5 -3.48Q252.35 -3.77 252.35 -4.17Q252.35 -4.65 252.61 -5.02Q252.87 -5.4 253.34 -5.61Q253.82 -5.82 254.48 -5.82Q255.43 -5.82 255.99 -5.38Q256.55 -4.95 256.65 -4.16H255.58Q255.53 -4.52 255.24 -4.72Q254.95 -4.92 254.47 -4.92Q253.96 -4.92 253.7 -4.74Q253.45 -4.55 253.45 -4.24Q253.45 -4.02 253.57 -3.85Q253.7 -3.68 253.99 -3.56Q254.27 -3.44 254.73 -3.37Q255.38 -3.27 255.84 -3.1Q256.31 -2.93 256.56 -2.59Q256.81 -2.26 256.8 -1.66Q256.81 -1.1 256.53 -0.7Q256.26 -0.3 255.77 -0.08Q255.27 0.13 254.61 0.13ZM258.14 0V-7.92H259.24V-4.79Q259.52 -5.27 260.01 -5.54Q260.49 -5.82 261.08 -5.82Q261.75 -5.82 262.22 -5.56Q262.69 -5.3 262.94 -4.78Q263.19 -4.26 263.19 -3.47V0H262.1V-3.35Q262.1 -4.11 261.75 -4.5Q261.41 -4.88 260.78 -4.88Q260.36 -4.88 260.01 -4.68Q259.66 -4.48 259.45 -4.09Q259.24 -3.7 259.24 -3.14V0Z";
const WM_PATH_W = 263.9;
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }
function wmPlotlyImage(){
  return { source: WM_LOGO_SRC, xref:'paper', yref:'paper', x:1, y:0.07, xanchor:'right', yanchor:'bottom',
    sizex:0.035, sizey:0.05, sizing:'contain', opacity:0.22, layer:'above' };
}
const $=id=>document.getElementById(id);
const SCENARIO_COLORS=['--line-a','--line-b','--line-c','--line-d','--line-e','--line-f'];
/* A missing custom property resolves to an empty string, which would paint
   nothing and, once concatenated with the band's alpha suffix, produce a colour
   string Chart.js cannot read. The stylesheet does define all six slots, so
   this is a guard rather than a fix: it only matters if one is ever dropped. */
const SCENARIO_COLORS_FALLBACK=['#5A91E8','#E63939','#3aaa86','#b07a00','#c45e7a','#0052CC'];
function cssVar(n){return getComputedStyle(document.body).getPropertyValue(n).trim();}
/* A scenario keeps its palette slot unless the user picks a colour for it, in
   which case that literal hex wins in both themes. Anything that draws or
   labels a scenario asks here, so the dot, the lines, the band shading, the
   sensitivity curve and the Best KPI can never disagree. */
function isHexColor(v){return typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);}
function defaultScenarioColor(i){
  const slot=SCENARIO_COLORS[i%SCENARIO_COLORS.length];
  return cssVar(slot)||SCENARIO_COLORS_FALLBACK[i%SCENARIO_COLORS_FALLBACK.length];
}
function scenarioColor(sc,i){
  return (sc&&isHexColor(sc.color))?sc.color:defaultScenarioColor(i);
}
let currentCurrencySymbol='$';

function moneySymbol(){return currentCurrencySymbol||'$';}
function moneyWithSymbol(n,{minimumFractionDigits=0,maximumFractionDigits=0}={}){
  const abs=Math.abs(Number(n||0));
  const formatted=abs.toLocaleString('en-US',{minimumFractionDigits,maximumFractionDigits});
  return moneySymbol()+formatted;
}

const fmt={
  currency(v,compact=false){
    const n=Number(v||0),abs=Math.abs(n),sign=n<0?'−':'';
    if(compact&&abs>=1e9)return sign+moneySymbol()+(abs/1e9).toFixed(2)+'b';
    if(compact&&abs>=1e6)return sign+moneySymbol()+(abs/1e6).toFixed(2)+'m';
    if(compact&&abs>=1e3)return sign+moneySymbol()+(abs/1e3).toFixed(1).replace(/\.0$/,'')+'k';
    return sign+moneyWithSymbol(abs,{maximumFractionDigits:0});
  },
  currencyExact(v){const n=Number(v||0);return(n<0?'−':'')+moneyWithSymbol(Math.abs(n),{minimumFractionDigits:2,maximumFractionDigits:2});},
  pct(v,d=2){const n=Number(v||0);const p=Math.abs(n)<=1?n*100:n;return p.toFixed(d)+'%';},
  num(v,d=0){return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});},
  fmtInput(v){const n=parseFloat(String(v).replace(/,/g,''));if(isNaN(n))return'0';if(n===Math.floor(n))return Math.floor(n).toLocaleString('en-US');return n.toLocaleString('en-US',{maximumFractionDigits:2});}
};

/* Auto-format number inputs */
function parseNumInput(el){return parseFloat(String(el.value).replace(/,/g,''))||0;}
function setupFmtInputs(){
  document.querySelectorAll('.fmt-num').forEach(el=>{
    SharedFmt.attachCurrencyInput(el,{maxDecimals:2,onChange:rerender});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.target.blur();}});
  });
}
function updateCurrencyPrefixes(){
  const sym=moneySymbol();
  ['purchaseCostPrefix','availableCashPrefix','scAdminFeePrefix'].forEach(id=>{
    const el=$(id);
    if(el)el.textContent=sym;
  });
}

// A net benefit smaller than half a cent cannot be shown at the precision we
// print, so treat it as an exact tie instead of a win for either side.
const NB_EPS=0.005, snapNB=v=>Math.abs(v)<=NB_EPS?0:v;
const HOVER_IDLE='Hover over the chart to inspect a period.';

let scenarios=[], editingIdx=-1, activeAmortIdx=0, sensMode='2d';
let persist=null; // mini cache handle (assigned at init)
let editorTermFreq='monthly'; // the frequency the editor's Term field currently shows
let baseRiskFreeRate=4.5; // global risk-free rate from Base tab

function periodsPerYear(f){return{weekly:52,fortnightly:26,monthly:12,yearly:1}[f]||12;}
function freqLabel(f){return{weekly:'week',fortnightly:'fortnight',monthly:'month',yearly:'year'}[f]||'period';}
function termUnitLabel(f){return{weekly:'weeks',fortnightly:'fortnights',monthly:'months',yearly:'years'}[f]||'periods';}
function termToYears(termPeriods,f){return termPeriods/periodsPerYear(f);}

// Default term in periods based on freq (5 years in each unit)
function defaultTerm(freq){return{weekly:260,fortnightly:130,monthly:60,yearly:5}[freq]||60;}

/* ─── Loan types ───────────────────────────────────────────────────────────
   The repayment structure a lender actually sells. Every type produces the same
   schedule rows, so everything downstream (chart, tables, CSV, sensitivity)
   reads one shape and does not branch on the type. */
const LOAN_TYPES=['annuity','flat','interestOnly','balloon','knownPayment','bullet','deferred'];
const LOAN_TYPE_LABEL={
  annuity:'Amortizing (fixed payment)',
  flat:'Flat rate',
  interestOnly:'Interest-only',
  balloon:'Balloon / residual',
  knownPayment:'Known repayment',
  bullet:'Bullet (lump at maturity)',
  deferred:'Deferred start',
};
// A rate schedule needs the rate to be an input that may change mid-loan. A flat
// loan fixes its interest at the outset by definition, and a known-repayment
// loan has the rate as its OUTPUT, so neither can carry one.
function supportsSchedule(t){return t!=='flat'&&t!=='knownPayment';}
function usesIoPeriods(t){return t==='interestOnly'||t==='deferred';}

/* Annual percentage to a period rate, under the convention the reader chose.
   'ear'     — compound conversion, (1+r)^(1/ppy)-1. The tool's original and
               still the default, so saved and shared scenarios are unchanged.
   'nominal' — r/ppy, the US APR convention: 12% p.a. monthly charges exactly
               1.000% a month, not 0.949%. */
let rateConvention='ear';
function toPeriodRate(annualPct,ppy){
  const a=Math.max(-0.999999,(Number(annualPct)||0)/100);
  return rateConvention==='nominal'?a/ppy:Math.pow(1+a,1/ppy)-1;
}
function periodRateToAnnualPct(r,ppy){
  if(r===null||!isFinite(r))return 0;
  return rateConvention==='nominal'?r*ppy*100:(Math.pow(1+r,ppy)-1)*100;
}
// The comparison number is always a true effective annual rate, whichever
// convention the loan was entered under. That is the whole point of the row.
// The snap is not cosmetic: solvePeriodRate() bisects to a residue of about
// 1e-14, so an interest-free plan whose payments sum to exactly the amount
// financed would otherwise print "-0.00%" and claim, in the sign, to be paying
// the reader to borrow. Nothing a lender could quote lives inside 1e-9 of a
// percentage point, so nothing real is being rounded away.
const RATE_EPS=1e-9;
function effectiveAnnual(rPeriod,ppy){
  if(rPeriod===null||!isFinite(rPeriod)||rPeriod<=-1)return null;
  const pct=(Math.pow(1+rPeriod,ppy)-1)*100;
  return Math.abs(pct)<RATE_EPS?0:pct;
}

/* ─── Rate and repayment schedules ─────────────────────────────────────────
   Ordered, consecutive periods counted in the scenario's OWN repayment periods.
   A fixed period is just min === max, which is what lets one code path serve
   fixed, variable, and fixed-then-variable without branching. The last period
   always stretches to the term, so gaps and overlaps cannot be entered.
   A rate schedule does not have to open on repayment 1: `startFrom` moves its
   first period, which is what a deferred start needs — nothing is repaid during
   the payment holiday, so the schedule speaks about the instalments that follow
   it. */
function normaliseRatePeriods(periods,termPeriods,fallbackRate,startFrom){
  const term=Math.max(1,Math.round(termPeriods||1));
  const out=[];let from=Math.min(term,Math.max(1,Math.round(startFrom||1)));
  if(Array.isArray(periods)){
    for(let i=0;i<periods.length&&from<=term;i++){
      const p=periods[i]||{};
      let to=Math.round(Number(p.toPeriod)||0);
      to=Math.min(term,Math.max(from,to));
      if(i===periods.length-1)to=term;
      let min,max;
      if(p.type==='floating'){const a=Number(p.rateMin)||0,b=Number(p.rateMax)||0;min=Math.min(a,b);max=Math.max(a,b);}
      else{min=max=Number(p.rate)||0;}
      out.push({from,to,min,max});
      from=to+1;
    }
  }
  if(!out.length)out.push({from,to:term,min:Number(fallbackRate)||0,max:Number(fallbackRate)||0});
  out[out.length-1].to=term;
  return out;
}
function normalisePaymentPeriods(periods,termPeriods,fallbackAmt){
  const term=Math.max(1,Math.round(termPeriods||1));
  const out=[];let from=1;
  if(Array.isArray(periods)){
    for(let i=0;i<periods.length&&from<=term;i++){
      const p=periods[i]||{};
      let to=Math.round(Number(p.toPeriod)||0);
      to=Math.min(term,Math.max(from,to));
      if(i===periods.length-1)to=term;
      out.push({from,to,amount:Math.max(0,Number(p.amount)||0)});
      from=to+1;
    }
  }
  if(!out.length)out.push({from:1,to:term,amount:Math.max(0,Number(fallbackAmt)||0)});
  out[out.length-1].to=term;
  return out;
}
/* The band a repayment falls in. A deferred start's schedule opens on the first
   instalment AFTER the holiday, so the holiday periods sit BELOW the first band:
   they capitalise at the rate the loan opens on, never at the last band's rate,
   which is what falling through to the end of the list would have charged. */
function bandForPeriod(norm,i){
  if(!norm||!norm.length)return null;
  if(i<norm[0].from)return norm[0];
  for(let k=0;k<norm.length;k++){if(i>=norm[k].from&&i<=norm[k].to)return norm[k];}
  return norm[norm.length-1];
}
// A missing band can only come of an empty schedule, which neither normaliser
// can produce; it reads as 0% rather than throwing halfway through a loan.
function rateFromBand(b,variant){if(!b)return 0;return variant==='low'?b.min:variant==='high'?b.max:(b.min+b.max)/2;}

/* The payment holiday / interest-only span, in repayments, for the one scenario
   shape that carries it. A scenario saved before the field existed means the
   whole term, which is what a plain interest-only loan is. Both the engine and
   the editor read the span from here, so the schedule the reader sees and the
   schedule the loan is built from cannot drift apart. */
function ioPeriodCount(sc,termPeriods){
  const term=Math.max(0,Math.round(termPeriods||0));
  if(!usesIoPeriods((sc&&sc.loanType)||'annuity'))return 0;
  const raw=(sc&&sc.ioPeriods!==undefined&&sc.ioPeriods!==null)?Number(sc.ioPeriods):term;
  return Math.min(term,Math.max(0,Math.round(isFinite(raw)?raw:term)));
}
/* The repayment a rate schedule opens on. Every structure starts at 1 except a
   deferred start, where nothing is repaid until the payment holiday is over, so
   period 1 of the schedule is the first instalment actually due. A holiday as
   long as the term still leaves the final settling payment, so the start never
   runs past the term. */
function rateScheduleStart(sc,termPeriods){
  const term=Math.max(1,Math.round(termPeriods||1));
  if(((sc&&sc.loanType)||'annuity')!=='deferred')return 1;
  return Math.min(term,ioPeriodCount(sc,term)+1);
}
function scenarioRateNorm(sc){
  const term=Math.max(1,Math.round(sc.termPeriods||1));
  if(sc.rateMode!=='schedule'||!supportsSchedule(sc.loanType||'annuity'))
    return[{from:1,to:term,min:Number(sc.financeRate)||0,max:Number(sc.financeRate)||0}];
  return normaliseRatePeriods(sc.ratePeriods,term,sc.financeRate,rateScheduleStart(sc,term));
}
// The single predicate that gates the whole band feature: legend entry, band
// datasets, hover-card range suffix and the extra low/high model runs.
function scenarioHasFloat(sc){return scenarioRateNorm(sc).some(p=>p.max-p.min>1e-9);}
// The repayment stream a known-repayment scenario actually asks for.
function scenarioPaymentStream(sc,n){
  if(sc.paymentMode==='schedule'){
    const norm=normalisePaymentPeriods(sc.paymentPeriods,n,sc.knownPayment);
    const out=[];for(let i=1;i<=n;i++){const p=bandForPeriod(norm,i);out.push(p?p.amount:0);}
    return out;
  }
  const amt=Math.max(0,Number(sc.knownPayment)||0);
  return new Array(n).fill(amt);
}

// Cached scenarios come back from localStorage and can be stale or hand-edited,
// so hold them to what the editor itself can produce. A loan with no repayment
// periods can never be repaid, so it is dropped rather than modelled. Anything
// this function does not name is DROPPED, so every new field has to be listed
// here or it silently vanishes on the next reload.
function normaliseScenario(sc){
  if(!sc||typeof sc!=='object')return null;
  const num=(v,d)=>{const n=parseFloat(v);return isFinite(n)?n:d;};
  const freq=['weekly','fortnightly','monthly','yearly'].includes(sc.freq)?sc.freq:'monthly';
  const term=Math.round(num(sc.termPeriods,0));
  if(!(term>=1))return null;
  let downPct=sc.downPaymentPct;
  if(downPct===undefined&&sc.downPayment!==undefined)downPct=(num(sc.downPayment,0)/(parseNumInput($('purchaseCost'))||1))*100;
  // A scenario saved before loan types existed is a plain fixed-rate annuity.
  const loanType=LOAN_TYPES.includes(sc.loanType)?sc.loanType:'annuity';
  const rateMode=(sc.rateMode==='schedule'&&supportsSchedule(loanType))?'schedule':'simple';
  const paymentMode=(sc.paymentMode==='schedule'&&loanType==='knownPayment')?'schedule':'single';
  const ratePeriods=Array.isArray(sc.ratePeriods)?sc.ratePeriods.map(p=>({
    toPeriod:Math.max(1,Math.round(num(p&&p.toPeriod,term))),
    type:(p&&p.type==='floating')?'floating':'fixed',
    rate:Math.max(0,num(p&&p.rate,5)),
    rateMin:Math.max(0,num(p&&p.rateMin,5)),
    rateMax:Math.max(0,num(p&&p.rateMax,5)),
  })):null;
  const paymentPeriods=Array.isArray(sc.paymentPeriods)?sc.paymentPeriods.map(p=>({
    toPeriod:Math.max(1,Math.round(num(p&&p.toPeriod,term))),
    amount:Math.max(0,num(p&&p.amount,0)),
  })):null;
  return{name:String(sc.name||'Scenario'),color:isHexColor(sc.color)?sc.color:null,
    financeRate:num(sc.financeRate,5),
    downPaymentPct:Math.min(100,Math.max(0,num(downPct,0))),termPeriods:term,freq,
    feeAmt:Math.max(0,num(sc.feeAmt,0)),feeType:sc.feeType==='pct'?'pct':'fixed',
    feeTreatment:['upfront','capitalise','discount'].includes(sc.feeTreatment)?sc.feeTreatment:'upfront',
    adminFee:Math.max(0,num(sc.adminFee,0)),
    loanType,rateMode,ratePeriods,paymentMode,paymentPeriods,
    knownPayment:Math.max(0,num(sc.knownPayment,0)),
    ioPeriods:Math.max(0,Math.round(num(sc.ioPeriods,term))),
    residualPct:Math.min(99,Math.max(0,num(sc.residualPct,0)))};
}

function defaultScenario(name,rate){
  const freq='monthly';
  return{name:name||'Scenario '+(scenarios.length+1),color:null,financeRate:rate||5,downPaymentPct:0,termPeriods:defaultTerm(freq),freq,feeAmt:0,feeType:'fixed',feeTreatment:'upfront',adminFee:0,
    loanType:'annuity',rateMode:'simple',ratePeriods:null,paymentMode:'single',paymentPeriods:null,knownPayment:0,ioPeriods:defaultTerm(freq),residualPct:0};
}

/*
 ══════════════════════════════════════════════════════════
 FINANCIAL ENGINE — VERIFIED MATHEMATICS
 ══════════════════════════════════════════════════════════

 1. PERIOD RATE — two conventions, chosen on the Base tab:
    Effective (default):  r_period = (1 + r_annual)^(1/ppy) − 1
    Nominal (US APR):     r_period = r_annual / ppy
    The risk-free rate always uses the effective conversion, because it
    describes a savings return, not a loan contract.

 2. AMORTIZATION PAYMENT (standard annuity formula):
    If r > 0:  PMT = P × r(1+r)^n / ((1+r)^n − 1)
    If r = 0:  PMT = P / n
    where P=principal, r=period rate, n=total periods

 3. EACH PERIOD (outstanding-balance products):
    interest_i  = balance_i × r_period
    principal_i = PMT − interest_i
    balance_{i+1} = balance_i − principal_i
    The final period always clears the exact remaining balance:
    payment_n = interest_n + balance_n.

 4. INVESTMENT GROWTH (financing path):
    Start with: availableCash − downPayment − upfrontFee
    Each period: investBal = investBal × (1 + rf_period) − PMT − adminFee
    rf_period = (1 + rf_annual)^(1/ppy) − 1
    adminFee is a fixed amount paid alongside every repayment (per period).
    Total admin cost = adminFee × n  (charged only while the loan is active).

 5. CASH PURCHASE BASELINE:
    leftover = availableCash − purchaseCost
    endWealth = leftover × (1 + rf_annual)^termYears

 6. NET BENEFIT = financing_endWealth − cash_endWealth
    Positive ⟹ financing preserves more wealth

 7. INFLATION: real = nominal / (1 + inflation)^years

 ── LOAN TYPES ────────────────────────────────────────────
 8. FLAT RATE (interest on the ORIGINAL principal):
    interest_i = P0 × r for every period (P0 = amount financed)
    principal_i = P0 / n,  PMT = P0/n + P0×r
    totalInterest = P0 × r × n
    This is why a "5% flat" loan costs roughly 9% effective: you keep paying
    interest on money you have already repaid.

 9. INTEREST-ONLY:
    i ≤ k:  PMT = balance × r,  principal_i = 0   (k = interest-only periods)
    i > k:  the §2 annuity over the remaining balance and remaining periods
    k = n gives pure interest-only, principal repaid in full at maturity.

10. BALLOON / RESIDUAL R:
    PMT = (P − R/(1+r)^n) × r(1+r)^n / ((1+r)^n − 1)
    The final payment is PMT + R, which §3's clearing rule produces exactly.

11. KNOWN REPAYMENT (rate solved):
    Given the stream {P_1 … P_n}, solve r from the terminal balance
    bal_i = bal_{i−1}(1+r) − P_i,  bal_n = 0
    by bisection. bal_n(r) is strictly increasing in r for non-negative
    payments, so the root is unique and bisection always converges when at
    least one payment is positive. The stream may be a single level amount or
    a stepped schedule (period 1–2 at X, 3–6 at Y, …).
    A payment below the interest due makes the balance RISE. That is real
    negative amortization, so it is reported, not suppressed.

12. BULLET: no payments at all; interest capitalises every period and the
    whole debt is settled at maturity: payment_n = P(1+r)^n.

13. DEFERRED START (capitalised holiday of k periods):
    i ≤ k:  PMT = 0, interest capitalises, balance_{i+1} = balance_i(1+r)
    i > k:  the §2 annuity over the grown balance and remaining periods
    This is the one structure where the balance rises ABOVE the original
    principal. Unlike §9 the interest is not paid, it is added to the debt.

14. VARIABLE RATE (schedule of consecutive periods, each fixed or floating):
    A fixed period is min == max. The payment is re-amortised over the
    REMAINING term on the outstanding balance whenever the rate changes,
    which is what a real lender does. A floating period is simulated three
    ways — min, midpoint, max — and the chart draws the midpoint as a line
    with the min–max range as a shaded band.
    The schedule runs from the first repayment to the end of the term. Under
    §13 that first repayment is k+1, not 1: no instalment falls due inside the
    payment holiday, so the schedule's periods are counted from the instalment
    that ends it, and the holiday itself capitalises at the schedule's opening
    rate.

15. EFFECTIVE RATE (APR): the internal rate of return of the actual payment
    stream against the amount financed, solved by the same bisection as §11,
    then annualised as (1+r)^ppy − 1. It is what makes a flat 5% and an
    annuity 5% comparable, and it drives the negative-carry warning.

16. FEE TREATMENT:
    upfront    — fee paid from your own cash; financed is unchanged (default)
    capitalise — fee added to the loan;  financed = base + fee
    discount   — fee deducted from the advance, so the advance must be grossed
                 up to still meet the price:  financed = base / (1 − feePct)
    Under the last two the fee is repaid inside the instalments, so it is
    counted in total out-of-pocket once, never twice.
 ══════════════════════════════════════════════════════════
*/

/* Terminal balance of a loan under a payment stream at period rate r.
   This multiplies only, so it stays finite at the bottom of the bisection
   bracket where the discounted-NPV form would raise (1+r) to a large negative
   power, underflow to zero and then divide by it on a long loan. */
function terminalBalance(principal,payments,r){
  let bal=principal;
  for(let i=0;i<payments.length;i++){bal=bal*(1+r)-payments[i];if(!isFinite(bal))return bal;}
  return bal;
}
/* Solve the period rate a payment stream implies. bal_n(r) is strictly
   increasing in r for non-negative payments, deeply negative at the low bracket
   and positive at the high one, so bisection always converges whenever at least
   one payment is positive. Returns null when there is nothing to solve, which
   the caller surfaces as an infeasible scenario rather than a confident zero. */
function solvePeriodRate(principal,payments){
  if(!(principal>0)||!payments||!payments.length)return null;
  if(!(payments.reduce((s,p)=>s+(p||0),0)>0))return null;
  let lo=-0.9999,hi=1;
  if(!(terminalBalance(principal,payments,lo)<0))return null;
  let guard=0;
  while(!(terminalBalance(principal,payments,hi)>0)&&guard++<80)hi*=2;
  if(!(terminalBalance(principal,payments,hi)>0))return null;
  for(let i=0;i<200&&hi-lo>1e-14;i++){
    const mid=(lo+hi)/2;
    if(terminalBalance(principal,payments,mid)>0)hi=mid;else lo=mid;
  }
  return(lo+hi)/2;
}

function annuityPmt(bal,r,m){
  if(m<=0)return bal;
  if(bal<=0)return 0;
  if(r===0)return bal/m;
  const f=Math.pow(1+r,m);
  return bal*(r*f)/(f-1);
}
// Annuity sized to leave exactly `res` outstanding after m periods.
function annuityPmtToResidual(bal,r,m,res){
  if(m<=0)return bal;
  const pv=r===0?res:res/Math.pow(1+r,m);
  return annuityPmt(bal-pv,r,m);
}

/* The one schedule builder. Every loan type funnels into the same row shape —
   {num,startBal,interest,principal,payment,endBal,rate} — so the chart, the
   tables, the CSV and the sensitivity sweep never branch on the type.
   `variant` is 'mid' | 'low' | 'high' and only matters for floating periods. */
function buildSchedule(sc,principal,freq,variant){
  const ppy=periodsPerYear(freq);
  const n=Math.max(0,Math.round(sc.termPeriods||0));
  const type=sc.loanType||'annuity';
  const empty={payment:0,finalPayment:0,schedule:[],totalInterest:0,totalPaid:0,periods:0,periodRate:0,
    effectiveRate:null,impliedAnnualRate:null,residualAmt:0,paymentVaries:false,negAm:false,solved:true};
  if(principal<=0||n<=0)return empty;

  const norm=scenarioRateNorm(sc);
  const v=variant||'mid';
  let impliedPeriodRate=null,solved=true;
  let rateAt;
  if(type==='knownPayment'){
    impliedPeriodRate=solvePeriodRate(principal,scenarioPaymentStream(sc,n));
    if(impliedPeriodRate===null){return Object.assign({},empty,{solved:false});}
    rateAt=()=>impliedPeriodRate;
  } else {
    rateAt=i=>toPeriodRate(rateFromBand(bandForPeriod(norm,i),v),ppy);
  }

  const schedule=[];
  let bal=principal,totalInt=0,negAm=false;
  const residualAmt=type==='balloon'?principal*(Math.min(99,Math.max(0,sc.residualPct||0))/100):0;
  const k=ioPeriodCount(sc,n);

  if(type==='flat'){
    // Flat interest is fixed at the outset on the original principal, so a rate
    // schedule cannot apply and the first period's rate is the only one.
    const r=rateAt(1),prinPer=principal/n,intPer=principal*r;
    for(let i=1;i<=n;i++){
      const prin=(i===n)?bal:prinPer;
      const endBal=(i===n)?0:Math.max(0,bal-prinPer);
      schedule.push({num:i,startBal:bal,interest:intPer,principal:prin,payment:prin+intPer,endBal,rate:r});
      totalInt+=intPer;bal=endBal;
    }
  } else {
    const stream=type==='knownPayment'?scenarioPaymentStream(sc,n):null;
    for(let i=1;i<=n;i++){
      const r=rateAt(i);
      const intPart=bal*r;
      let pay,prin,endBal;
      if(i===n){
        // Whatever the product, the last period settles the debt exactly. For a
        // balloon this is PMT + residual, for a bullet it is the whole grown
        // debt, and for an annuity it is the ordinary final instalment.
        pay=intPart+bal;prin=bal;endBal=0;
      } else {
        if(type==='annuity')pay=annuityPmt(bal,r,n-i+1);
        else if(type==='interestOnly')pay=i<=k?intPart:annuityPmt(bal,r,n-i+1);
        else if(type==='balloon')pay=annuityPmtToResidual(bal,r,n-i+1,residualAmt);
        else if(type==='bullet')pay=0;
        else if(type==='deferred')pay=i<=k?0:annuityPmt(bal,r,n-i+1);
        else pay=stream[i-1];
        prin=pay-intPart;
        if(prin>bal)prin=bal;
        // A payment below the interest due grows the debt. By design for a
        // bullet or a deferred start; a red flag for a known repayment.
        if(prin<0&&type==='knownPayment')negAm=true;
        endBal=Math.max(0,bal-prin);
      }
      schedule.push({num:i,startBal:bal,interest:intPart,principal:prin,payment:pay,endBal,rate:r});
      totalInt+=intPart;bal=endBal;
    }
  }

  /* The same 1e-14 residue lands in the interest column as bal x r per period,
     so a 0% plan accrues about -4e-10 of "interest" over its term. Snapped
     here rather than in the formatter, because totalInterest is not only
     printed: it is an optimisation target, it is summed into the financing
     cost, and "lowest total interest" must not be won by a rounding artefact.
     A ten-thousandth of a cent is below anything a contract can express. */
  const MONEY_EPS=1e-6;
  if(Math.abs(totalInt)<MONEY_EPS)totalInt=0;
  schedule.forEach(row=>{if(Math.abs(row.interest)<MONEY_EPS)row.interest=0;});

  const totalPaid=schedule.reduce((s,p)=>s+p.payment,0);
  const first=schedule[0]?schedule[0].payment:0;
  const finalPayment=schedule[n-1]?schedule[n-1].payment:0;
  let paymentVaries=false;
  for(let i=0;i<schedule.length-1;i++){if(Math.abs(schedule[i].payment-first)>0.005){paymentVaries=true;break;}}
  if(!paymentVaries&&schedule.length>1&&Math.abs(finalPayment-first)>0.005)paymentVaries=true;
  const irr=solvePeriodRate(principal,schedule.map(p=>p.payment));
  return{payment:first,finalPayment,schedule,totalInterest:totalInt,totalPaid,periods:n,
    periodRate:schedule[0]?schedule[0].rate:0,
    effectiveRate:effectiveAnnual(irr,ppy),
    impliedAnnualRate:impliedPeriodRate===null?null:effectiveAnnual(impliedPeriodRate,ppy),
    residualAmt,paymentVaries,negAm,solved};
}

// Kept as the named entry point the engine notes above describe. Everything
// goes through buildSchedule so there is only one place a schedule is built.
function computeAmortization(principal, annualRate, termPeriods, freq){
  return buildSchedule({loanType:'annuity',rateMode:'simple',financeRate:annualRate,termPeriods},principal,freq,'mid');
}

/* How the origination fee is settled. Only 'upfront' spends your own cash; the
   other two put the fee inside the loan, which means you also pay interest on
   it, and which is why the fee must not then be added to out-of-pocket twice. */
function resolveFinancing(sc,base){
  const treat=['upfront','capitalise','discount'].includes(sc.feeTreatment)?sc.feeTreatment:'upfront';
  const pct=sc.feeType==='pct';
  const amt=Math.max(0,sc.feeAmt||0);
  if(treat==='upfront'){
    const fee=pct?base*(amt/100):amt;
    return{financed:base,fee,cashFee:fee};
  }
  if(treat==='discount'){
    // The advance arrives net of the fee, so it has to be grossed up for the
    // net proceeds to still cover the price.
    if(pct&&amt>=100)return null;
    const financed=pct?base/(1-amt/100):base+amt;
    return{financed,fee:financed-base,cashFee:0};
  }
  const fee=pct?base*(amt/100):amt;
  return{financed:base+fee,fee,cashFee:0};
}

function dropReason(sc,purchaseCost,availableCash){
  const downPct=Math.min(100,Math.max(0,sc.downPaymentPct||0));
  const down=Math.min(purchaseCost*(downPct/100),purchaseCost,availableCash);
  const fin=resolveFinancing(sc,purchaseCost-down);
  if(!fin)return'fee';
  if(availableCash-down-fin.cashFee<0)return'upfront';
  return'unsolvable';
}

function computeScenario(sc, purchaseCost, availableCash, riskFreeRate, inflationRate, inflationEnabled, variant){
  const downPct=Math.min(100,Math.max(0,sc.downPaymentPct||0));
  const requestedDown=purchaseCost*(downPct/100);
  const down=Math.min(requestedDown,purchaseCost,availableCash);
  const base=purchaseCost-down;
  const termYears=termToYears(sc.termPeriods,sc.freq);
  if(base<=0) return computeScenarioAsCash(purchaseCost,availableCash,sc,riskFreeRate,inflationRate,inflationEnabled);

  const ppy=periodsPerYear(sc.freq);
  const n=Math.round(sc.termPeriods);
  const fin=resolveFinancing(sc,base);
  if(!fin) return null;
  const financed=fin.financed,fee=fin.fee;
  const adminFee=Math.max(0,sc.adminFee||0); // fixed amount paid every repayment
  const cashAfterUpfront=availableCash-down-fin.cashFee;
  if(cashAfterUpfront<0) return null;

  const amort=buildSchedule(sc,financed,sc.freq,variant||'mid');
  if(!amort.solved) return null;
  const rfPeriod=Math.pow(1+riskFreeRate/100,1/ppy)-1;
  let investBal=cashAfterUpfront;
  const timeline=[{period:0,investBal:cashAfterUpfront,loanBal:financed,wealth:cashAfterUpfront-financed,cumInterest:0,cumPaid:0,cumAdmin:0}];
  let cumInt=0,cumPaid=0,cumAdmin=0;

  for(let i=0;i<n;i++){
    investBal=investBal*(1+rfPeriod); // grow first
    const pmt=amort.schedule[i]?amort.schedule[i].payment:amort.payment;
    investBal-=pmt; // then pay the loan instalment
    investBal-=adminFee; // and the fixed admin fee charged every repayment
    cumInt+=(amort.schedule[i]?amort.schedule[i].interest:0);
    cumPaid+=pmt+adminFee;
    cumAdmin+=adminFee;
    const loanBal=amort.schedule[i]?amort.schedule[i].endBal:0;
    timeline.push({period:i+1,investBal,loanBal,wealth:investBal-loanBal,cumInterest:cumInt,cumPaid,cumAdmin});
  }

  const endWealth=investBal;
  const totalAdminFee=adminFee*n; // admin fee charged once per repayment over the full term
  const totalFee=fee+totalAdminFee; // all fees: origination + recurring admin
  const totalFinanceCost=amort.totalInterest+totalFee;
  // A capitalised or discounted fee is repaid inside the instalments, so it is
  // already inside totalPaid and must not be added again here.
  const totalOOP=down+fin.cashFee+amort.totalPaid+totalAdminFee;
  let inflAdj=null;
  if(inflationEnabled&&inflationRate>0){
    const rd=Math.pow(1+inflationRate/100,termYears);
    inflAdj={endWealthReal:endWealth/rd,totalFinanceCostReal:totalFinanceCost/rd};
  }
  // Carry is judged on what the loan actually costs, not on the headline rate:
  // a 5% flat loan really costs about 9%, and the warning has to say so.
  const effRate=amort.effectiveRate;
  return{down,financed,fee,cashFee:fin.cashFee,feeTreatment:sc.feeTreatment||'upfront',adminFee,totalAdminFee,amort,endWealth,
    totalInterest:amort.totalInterest,totalFee,totalFinanceCost,payment:amort.payment,finalPayment:amort.finalPayment,
    paymentVaries:amort.paymentVaries,negAm:amort.negAm,effectiveRate:effRate,impliedAnnualRate:amort.impliedAnnualRate,
    residualAmt:amort.residualAmt,loanType:sc.loanType||'annuity',rateMode:sc.rateMode||'simple',
    totalOOP,timeline,negCarry:riskFreeRate<(effRate===null?sc.financeRate:effRate),inflAdj,cashAfter:cashAfterUpfront,
    n,ppy,termYears,termPeriods:sc.termPeriods,riskFreeRate,financeRate:sc.financeRate,freq:sc.freq};
}

function computeScenarioAsCash(purchaseCost,availableCash,sc,riskFreeRate,inflationRate,inflationEnabled){
  const leftover=Math.max(0,availableCash-purchaseCost);
  const ppy=periodsPerYear(sc.freq);
  const n=Math.round(sc.termPeriods);
  const termYears=termToYears(sc.termPeriods,sc.freq);
  const rfP=Math.pow(1+riskFreeRate/100,1/ppy)-1;
  let bal=leftover;
  const timeline=[{period:0,investBal:leftover,loanBal:0,wealth:leftover,cumInterest:0,cumPaid:0}];
  for(let i=0;i<n;i++){bal*=(1+rfP);timeline.push({period:i+1,investBal:bal,loanBal:0,wealth:bal,cumInterest:0,cumPaid:0});}
  let inflAdj=null;
  if(inflationEnabled&&inflationRate>0) inflAdj={endWealthReal:bal/Math.pow(1+inflationRate/100,termYears)};
  return{down:purchaseCost,financed:0,fee:0,cashFee:0,feeTreatment:'upfront',adminFee:0,totalAdminFee:0,amort:{payment:0,finalPayment:0,schedule:[],totalInterest:0,totalPaid:0,periods:0,periodRate:0,effectiveRate:null,impliedAnnualRate:null,residualAmt:0,paymentVaries:false,negAm:false,solved:true},endWealth:bal,totalInterest:0,totalFee:0,totalFinanceCost:0,payment:0,finalPayment:0,paymentVaries:false,negAm:false,effectiveRate:null,impliedAnnualRate:null,residualAmt:0,loanType:sc.loanType||'annuity',rateMode:sc.rateMode||'simple',totalOOP:purchaseCost,timeline,negCarry:false,inflAdj,cashAfter:leftover,n,ppy,termYears,termPeriods:sc.termPeriods,riskFreeRate,financeRate:sc.financeRate,freq:sc.freq};
}

function computeCashBaseline(purchaseCost,availableCash,termYears,riskFreeRate,inflationRate,inflationEnabled){
  const leftover=Math.max(0,availableCash-purchaseCost);
  const endWealth=leftover*Math.pow(1+riskFreeRate/100,termYears);
  let inflAdj=null;
  if(inflationEnabled&&inflationRate>0) inflAdj={endWealthReal:endWealth/Math.pow(1+inflationRate/100,termYears)};
  return{endWealth,investedCash:leftover,inflAdj};
}

function quickNetBenefit(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled,objective){
  const res=computeScenario(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled);
  if(!res)return null;
  const cb=computeCashBaseline(purchaseCost,availableCash,res.termYears,riskFreeRate,inflationRate,inflationEnabled);
  const nb=res.endWealth-cb.endWealth;
  if(objective==='netBenefit')return nb;
  if(objective==='totalInterest')return res.totalInterest;
  if(objective==='totalFinanceCost')return res.totalFinanceCost;
  if(objective==='endWealth')return res.endWealth;
  if(objective==='inflAdjNetBenefit'){if(!res.inflAdj||!cb.inflAdj)return nb;return(res.inflAdj.endWealthReal||0)-(cb.inflAdj.endWealthReal||0);}
  return nb;
}

/* ─── Rendering ─── */
let chartInstance=null,sensChartInstance=null,latestResults=null;

function rerender(){
  const purchaseCost=Math.max(0,parseNumInput($('purchaseCost')));
  // A blank, zero or unreadable cash field is not permission to assume the user
  // happens to hold exactly the purchase price. Use what was actually typed and
  // let the affordability guard below say so out loud.
  const availableCash=Math.max(0,parseNumInput($('availableCash')));
  const inflationEnabled=$('inflationToggle').checked;
  const inflationRate=parseFloat($('inflationRate').value)||0;
  const riskFreeRate=parseFloat($('baseRf').value)||0;
  baseRiskFreeRate=riskFreeRate;
  $('inflationRow').style.display=inflationEnabled?'':'none';
  const optTarget=$('optTarget').value;
  currentCurrencySymbol=$('currencySymbol').value||'$';
  rateConvention=$('rateConvention').value==='nominal'?'nominal':'ear';
  updateCurrencyPrefixes();
  $('scFeeType').querySelector('option[value="fixed"]').textContent=moneySymbol();

  let warn='';
  const cashMissing = !(availableCash>0);
  const cashShortfall = availableCash < purchaseCost;
  if(cashMissing||cashShortfall){
    warn=cashMissing
      ? '⚠ Available cash reads '+fmt.currencyExact(0)+'. Enter the cash you could put toward this purchase today. Nothing is assumed on your behalf, so the results below stay blank until you do.'
      : '⚠ Available cash ('+fmt.currencyExact(availableCash)+') is less than the purchase cost ('+fmt.currencyExact(purchaseCost)+'). Financing something you cannot afford upfront is not modelled here, so please increase your available cash or reduce the purchase cost.';
    $('warnBanner').style.display='block';$('warnBanner').textContent=warn;
    $('negCarryBanner').style.display='none';
    // Clear all outputs
    ['kpiBest','kpiNetBenefit','kpiInterest','kpiCashWealth'].forEach(id=>{$(id).textContent='—';$(id).style.color=cssVar('--text');});
    ['kpiBestSub','kpiNetSub','kpiIntSub','kpiCashSub'].forEach(id=>{$(id).textContent='';});
    if(chartInstance){chartInstance.destroy();chartInstance=null;}
    $('chartLegend').innerHTML='';
    $('compTableWrap').innerHTML='<p class="muted">Adjust inputs above to run the simulation.</p>';
    $('amortTabs').innerHTML='';
    $('amortTableWrap').innerHTML='<p class="muted">Adjust inputs above to run the simulation.</p>';
    return;
  }
  $('warnBanner').style.display='none';$('warnBanner').textContent='';

  const results=[];let anyNegCarry=false,anyNegAm=false;const dropped=[];
  scenarios.forEach((sc,i)=>{
    const res=computeScenario(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled);
    if(res){
      res.name=sc.name;res.idx=i;res.color=scenarioColor(sc,i);
      if(res.negCarry)anyNegCarry=true;
      if(res.negAm)anyNegAm=true;
      // A floating period is simulated three ways. The model itself never knows
      // about bands: it is simply run again along the min and the max path.
      if(scenarioHasFloat(sc)){
        res.bandLo=computeScenario(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled,'low');
        res.bandHi=computeScenario(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled,'high');
      }
    }
    else dropped.push({name:sc.name,why:dropReason(sc,purchaseCost,availableCash)});
    results.push(res);
  });
  const carryMsgs=[];
  if(anyNegCarry)carryMsgs.push('⚠ Negative carry: the effective cost of borrowing exceeds the risk-free rate. Financing will likely cost more than investing.');
  // A repayment below the interest due grows the debt. That is a real outcome,
  // so it is named rather than quietly folded into the numbers.
  if(anyNegAm)carryMsgs.push('⚠ Negative amortization: a repayment is smaller than the interest due, so the balance grows before it falls.');
  $('negCarryBanner').style.display=carryMsgs.length?'block':'none';
  $('negCarryBanner').textContent=carryMsgs.join('  ');
  // A scenario whose down payment + upfront fee exceeds available cash can't be
  // modelled; surface it instead of silently dropping it from the comparison.
  if(dropped.length){
    const REASON={
      upfront:'the down payment plus upfront fee exceeds your available cash. Lower the down payment or fee, or increase available cash.',
      fee:'a fee of 100% or more cannot be deducted from the advance. Lower the fee or settle it another way.',
      unsolvable:'no interest rate makes that repayment plan pay the loan off. Raise the repayment or shorten the term.'
    };
    const byWhy={};
    dropped.forEach(d=>{(byWhy[d.why]=byWhy[d.why]||[]).push(d.name);});
    $('warnBanner').style.display='block';
    // Name the real cause: blaming the down payment for an unsolvable repayment
    // plan sends the reader to fix the wrong control.
    $('warnBanner').textContent=Object.keys(byWhy).map(w=>
      '⚠ '+byWhy[w].join(', ')+(byWhy[w].length>1?' were':' was')+' skipped: '+(REASON[w]||REASON.upfront)).join('  ');
  }

  results.forEach(r=>{if(!r)return;const cb=computeCashBaseline(purchaseCost,availableCash,r.termYears,riskFreeRate,inflationRate,inflationEnabled);r.cashBaseWealth=cb.endWealth;r.netBenefit=r.endWealth-cb.endWealth;if(r.inflAdj&&cb.inflAdj)r.inflAdj.netBenefitReal=(r.inflAdj.endWealthReal||0)-(cb.inflAdj.endWealthReal||0);
    // The two band paths are scored against the very same baseline, so the
    // range row reads on the same footing as the midpoint above it.
    [r.bandLo,r.bandHi].forEach(b=>{if(b){b.cashBaseWealth=cb.endWealth;b.netBenefit=b.endWealth-cb.endWealth;}});});

  const valid=results.filter(r=>r);
  let bestIdx=-1;
  if(valid.length){
    if(optTarget==='netBenefit')bestIdx=valid.reduce((b,r)=>r.netBenefit>(results[b]?.netBenefit??-Infinity)?r.idx:b,valid[0].idx);
    else if(optTarget==='lowestInterest')bestIdx=valid.reduce((b,r)=>r.totalInterest<(results[b]?.totalInterest??Infinity)?r.idx:b,valid[0].idx);
    else if(optTarget==='lowestCost')bestIdx=valid.reduce((b,r)=>r.totalFinanceCost<(results[b]?.totalFinanceCost??Infinity)?r.idx:b,valid[0].idx);
  }
  const allNeg=valid.every(r=>r.netBenefit<-NB_EPS);
  const bestResult=bestIdx>=0?results[bestIdx]:null;
  // Comparison horizon = the longest scenario actually being compared, so the
  // KPI tile, the chart's cash line and the table's cash column all end together.
  const maxTerm=valid.reduce((m,r)=>Math.max(m,r.termYears),0);
  const cashBase=computeCashBaseline(purchaseCost,availableCash,maxTerm,riskFreeRate,inflationRate,inflationEnabled);
  latestResults={results,cashBase,bestIdx,allNeg,purchaseCost,availableCash,maxTerm,inflationEnabled,inflationRate,riskFreeRate};

  // KPIs
  const tie=!!bestResult&&Math.abs(bestResult.netBenefit)<=NB_EPS;
  if(tie){$('kpiBest').textContent='Break-even';$('kpiBest').style.color=cssVar('--text');$('kpiBestSub').textContent=bestResult.name+' is level with paying cash.';}
  else if(allNeg||!bestResult){$('kpiBest').textContent='Cash Purchase';$('kpiBest').style.color=cssVar('--accent2');$('kpiBestSub').textContent=valid.length?'No financing scenario beats paying cash.':'Add scenarios to compare.';}
  else{$('kpiBest').textContent=bestResult.name;$('kpiBest').style.color=bestResult.color;$('kpiBestSub').textContent='Based on '+$('optTarget').selectedOptions[0].text.toLowerCase()+'.';}
  if(bestResult){const nb=snapNB(bestResult.netBenefit),cashWins=allNeg&&!tie;$('kpiNetBenefit').textContent=fmt.currency(nb,true);$('kpiNetBenefit').style.color=nb>0?cssVar('--positive-em'):nb<0?cssVar('--negative-em'):cssVar('--text');$('kpiNetSub').textContent=nb>0?'Financing is more wealth-efficient':nb<0?'Cash purchase preserves more wealth':'Financing and paying cash end up level';
    // The "(Best)" tiles must describe the strategy the verdict names: when the
    // cash purchase wins there is no loan, so there is no interest.
    $('kpiInterest').textContent=fmt.currency(cashWins?0:bestResult.totalInterest,true);$('kpiInterest').style.color=cssVar('--text');$('kpiIntSub').textContent=cashWins?'Paying cash pays no interest.':paymentTxt(bestResult);}
  else{$('kpiNetBenefit').textContent='—';$('kpiNetBenefit').style.color=cssVar('--text');$('kpiNetSub').textContent='';$('kpiInterest').textContent='—';$('kpiInterest').style.color=cssVar('--text');$('kpiIntSub').textContent='';}
  $('kpiCashWealth').textContent=fmt.currency(cashBase.endWealth,true);$('kpiCashWealth').style.color=cssVar('--text');$('kpiCashSub').textContent=maxTerm>0?`After ${maxTerm.toFixed(1)} yr at ${fmt.pct(riskFreeRate/100)} risk-free`:'Cash left after buying outright.';

  renderMainChart(results);renderComparisonTable(results);renderAmortTabs(results);updateSensScenarioDropdown();
  // The sweep is built from the same purchase cost, cash and rates as the panel
  // above it, so it has to move when they do. Leaving it to a button meant a
  // surface could sit there describing a plan the reader had already edited.
  scheduleSensitivity();
}

function renderMainChart(results){
  const metric=$('chartMetric').value;
  const titles={wealth:'Ending Wealth Over Time',netBenefit:'Net Benefit vs Cash Purchase',investmentValue:'Investment Value Over Time',loanBalance:'Loan Balance Over Time'};
  $('chartTitle').textContent=titles[metric]||'Chart';
  // Plot on a real-time (years) x-axis so scenarios with different payment
  // frequencies align by actual duration, not by raw period index (a 5-year
  // yearly loan and a 5-year monthly loan must both span 0–5 on the axis).
  const maxYears=results.reduce((m,r)=>r?Math.max(m,r.n/r.ppy):m,0);
  if(maxYears===0){if(chartInstance){chartInstance.destroy();chartInstance=null;}return;}
  const rfAnnual=latestResults.riskFreeRate/100;
  const left=Math.max(0,latestResults.availableCash-latestResults.purchaseCost);
  // Shared ~monthly sampling grid: every line uses identical x positions so the
  // multi-scenario tooltip stays aligned.
  const steps=Math.max(1,Math.round(maxYears*12));
  const xs=[];for(let k=0;k<=steps;k++)xs.push(maxYears*k/steps);

  // Metric value of a result at a (possibly fractional) period index. Within the
  // recorded timeline it interpolates between periods; past the loan term the
  // leftover keeps compounding at the risk-free rate.
  function periodValue(r, p, rfP_r){
    const at=idx=>{const t=r.timeline[idx];
      if(metric==='wealth')return t.wealth;
      if(metric==='netBenefit')return t.wealth-left*Math.pow(1+rfP_r,idx);
      if(metric==='investmentValue')return t.investBal;
      return t.loanBal;};
    if(p<=r.timeline.length-1){
      const lo=Math.max(0,Math.floor(p)), hi=Math.min(r.timeline.length-1,Math.ceil(p));
      return lo===hi ? at(lo) : at(lo)+(at(hi)-at(lo))*(p-lo);
    }
    const lastT=r.timeline[r.timeline.length-1];
    const grown=lastT.investBal*Math.pow(1+rfP_r,p-(r.timeline.length-1));
    if(metric==='wealth')return grown;
    if(metric==='netBenefit')return grown-left*Math.pow(1+rfP_r,p);
    if(metric==='investmentValue')return grown;
    return 0; // loanBalance after payoff
  }

  const datasets=[],legendItems=[],bandDatasets=[],bandColors=[];
  // The key is built from each entry's OWN spec rather than from datasets[i]:
  // the band adds two datasets that are one mark, so the two lists no longer
  // run in lockstep.
  const pushSeries=(ds,label)=>{datasets.push(ds);legendItems.push({label,spec:SharedLegend.specOf(ds)});};
  if(metric==='wealth'){
    const cd=xs.map(yr=>({x:yr,y:left*Math.pow(1+rfAnnual,yr)}));
    pushSeries({label:'Cash Purchase',data:cd,borderColor:cssVar('--muted'),backgroundColor:'transparent',borderWidth:2,borderDash:[6,4],pointRadius:0,pointHoverRadius:4,tension:.3,fill:false},'Cash Purchase');
  }
  results.forEach(r=>{if(!r)return;const color=r.color;
    const rfP_r=Math.pow(1+rfAnnual,1/r.ppy)-1;
    const data=xs.map(yr=>({x:yr,y:periodValue(r, yr*r.ppy, rfP_r)}));
    r.bandSeries=null;
    pushSeries({label:r.name,data,borderColor:color,backgroundColor:color+'22',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:.3,fill:false,fvcRef:r},r.name);
    if(r.bandLo&&r.bandHi){
      const lo=xs.map(yr=>periodValue(r.bandLo, yr*r.bandLo.ppy, rfP_r));
      const hi=xs.map(yr=>periodValue(r.bandHi, yr*r.bandHi.ppy, rfP_r));
      let maxDiff=0;for(let k=0;k<xs.length;k++)maxDiff=Math.max(maxDiff,Math.abs(hi[k]-lo[k]));
      // A band narrower than fifty cents is noise, not information.
      if(maxDiff>0.5){
        r.bandSeries={lo,hi};bandColors.push(color);
        bandDatasets.push({label:r.name+' (band)',data:xs.map((yr,k)=>({x:yr,y:hi[k]})),borderColor:'transparent',backgroundColor:'transparent',borderWidth:0,pointRadius:0,pointHoverRadius:0,tension:.3,fill:false,isBand:true});
        bandDatasets.push({label:r.name+' (band)',data:xs.map((yr,k)=>({x:yr,y:lo[k]})),borderColor:'transparent',backgroundColor:color+'30',borderWidth:0,pointRadius:0,pointHoverRadius:0,tension:.3,fill:'-1',isBand:true});
      }
    }
  });
  // Appended last because Chart.js paints datasets last to first, so the
  // shading lands beneath every line with no draw-order juggling.
  bandDatasets.forEach(d=>datasets.push(d));
  // A band is two datasets but one thing on the chart, so it is one entry.
  if(bandColors.length)legendItems.push({label:'Variable-rate range (min–max)',
    spec:{type:'area',fill:bandColors[0]+'30',fill2:bandColors[1]?bandColors[1]+'30':undefined}});
  // Each entry is drawn as its series is: the cash line dashed, the financed
  // lines solid, the range as the block it is shaded with.
  const le=$('chartLegend');le.innerHTML='';
  legendItems.forEach(l=>{const d=document.createElement('div');d.className='legend-item';SharedLegend.attach(d,l.spec,l.label);le.appendChild(d);});
  const yAxisLabel={wealth:`Wealth (${moneySymbol()})`,netBenefit:`Net Benefit (${moneySymbol()})`,investmentValue:`Investment Value (${moneySymbol()})`,loanBalance:`Loan Balance (${moneySymbol()})`}[metric]||`Value (${moneySymbol()})`;
  const xLabelOf=v=>{const n=+v;return Number.isInteger(n)?`Year ${n}`:`Year ${n.toFixed(2)}`;};
  const gc=cssVar('--chart-grid'),mc=cssVar('--chart-text'),tc=cssVar('--text');
  const tipLight=document.body.classList.contains('light');
  const tipBg=tipLight?'#FFFFFF':'#1e1e2e',tipTitle=tipLight?'#2D3436':'#EAF1FF',tipBody=tipLight?'#4A5A6A':'#A8B6CF',tipBorder=tipLight?'#D4DEEF':gc;
  const cfg={type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},interaction:{mode:'index',intersect:false},onHover:(e,els,ch)=>{
    const hb=$('hoverBox');if(!hb)return;
    if(!els.length){hb.textContent=HOVER_IDLE;return;}
    const i=els[0].index;
    const parts=[];
    ch.data.datasets.forEach(ds=>{
      if(ds.isBand)return; // the range rides its own series' entry, as in the card
      const pt=ds.data[i];if(!pt)return;
      let txt=`${ds.label}: ${fmt.currency(pt.y,true)}`;
      const rr=ds.fvcRef;
      if(rr&&rr.bandSeries){
        const a=Math.min(rr.bandSeries.lo[i],rr.bandSeries.hi[i]),b2=Math.max(rr.bandSeries.lo[i],rr.bandSeries.hi[i]);
        if(Math.abs(b2-a)>0.5)txt+=` (${fmt.currency(a,true)} – ${fmt.currency(b2,true)})`;
      }
      parts.push(txt);
    });
    const x0=ch.data.datasets[0].data[i];
    hb.textContent=(x0?xLabelOf(x0.x)+'  ·  ':'')+parts.join('  |  ');
  },plugins:{legend:{display:false},tooltip:SharedChartTip.options({filter:item=>!item.dataset.isBand,callbacks:{title:c=>xLabelOf(c[0].parsed.x),label:c=>{
    let t=`  ${c.dataset.label}: ${fmt.currency(c.parsed.y,true)}`;
    const rr=c.dataset.fvcRef;
    if(rr&&rr.bandSeries){
      const a=Math.min(rr.bandSeries.lo[c.dataIndex],rr.bandSeries.hi[c.dataIndex]),b=Math.max(rr.bandSeries.lo[c.dataIndex],rr.bandSeries.hi[c.dataIndex]);
      if(Math.abs(b-a)>0.5)t+=` (${fmt.currency(a,true)} – ${fmt.currency(b,true)})`;
    }
    return t;
  }},backgroundColor:tipBg,titleColor:tipTitle,bodyColor:tipBody,borderColor:tipBorder,borderWidth:1,padding:10,}),zoom:SharedZoom.options({min:0,max:maxYears,points:xs.length}),sharedYFit:{auto:{axes:['y']}}},scales:{x:{type:'linear',title:{display:true,text:'Years',color:mc,font:{size:12}},ticks:{color:mc,maxTicksLimit:12,font:{size:11}},grid:{color:gc}},y:{title:{display:true,text:yAxisLabel,color:mc,font:{size:12}},ticks:{color:mc,font:{size:11},callback:v=>fmt.currency(v,true)},grid:{color:gc}}}}};
  // The limits travel with the data: a shorter term means a shorter axis to
  // pan across, so they are rewritten on an in-place update too.
  if(chartInstance){chartInstance.data=cfg.data;chartInstance.options.plugins.zoom=cfg.options.plugins.zoom;chartInstance.options.scales.x.ticks.color=mc;chartInstance.options.scales.x.grid.color=gc;chartInstance.options.scales.x.title.color=mc;chartInstance.options.scales.y.ticks.color=mc;chartInstance.options.scales.y.grid.color=gc;chartInstance.options.scales.y.title.color=mc;chartInstance.options.scales.y.title.text=yAxisLabel;chartInstance.update('none');}
  else chartInstance=new Chart($('chartCanvas'),{...cfg,plugins:[SharedZoom.plugin]});
}

/* A single scalar cannot describe an interest-only, balloon, stepped or
   deferred loan, so say what the instalments actually do: one figure when they
   are level, the span when they are not, and plain words when there are none. */
function paymentTxt(r){
  const sch=r.amort&&r.amort.schedule;
  if(!sch||!sch.length)return'—';
  const body=sch.length>1?sch.slice(0,-1):sch;
  let lo=Infinity,hi=-Infinity;
  body.forEach(p=>{lo=Math.min(lo,p.payment);hi=Math.max(hi,p.payment);});
  if(!isFinite(lo))return'—';
  const per='/'+freqLabel(r.freq);
  if(Math.abs(hi-lo)<0.005)return lo>0.005?fmt.currencyExact(lo)+per:'None until the final payment';
  return fmt.currencyExact(lo)+' → '+fmt.currencyExact(hi)+per;
}

// Horizons are compared in years, but a sub-year term reads better in months.
function horizonTxt(y){const n=Number(y)||0;return n>0&&n<1?(n*12).toFixed(1)+' mo':n.toFixed(1)+' yr';}

function renderComparisonTable(results){
  const valid=results.filter(r=>r);if(!valid.length){$('compTableWrap').innerHTML='<p class="muted">Add financing scenarios to compare.</p>';return;}
  const inflOn=latestResults.inflationEnabled,pc=latestResults.purchaseCost;
  let h='<table><thead><tr><th>Metric</th><th>Cash Purchase</th>';valid.forEach(r=>{h+='<th>'+r.name+'</th>';});h+='</tr></thead><tbody>';
  const rows=[
    // What the product IS comes before what it costs.
    ['Loan Type','Pay in full',r=>(LOAN_TYPE_LABEL[r.loanType]||LOAN_TYPE_LABEL.annuity)+(r.rateMode==='schedule'?' · scheduled rate':'')],
    ['Down Payment (%)','—',r=>fmt.pct((r.down/latestResults.purchaseCost)||0,2)],
    ['Down Payment Amount','—',r=>fmt.currency(r.down)],['Financed Amount','—',r=>fmt.currency(r.financed)],
    ['Periodic Payment','—',r=>paymentTxt(r)],
    // What the loan really costs, so a flat 5% and an annuity 5% can be read
    // against each other instead of against their headline numbers.
    ['Effective Rate (APR)','—',r=>r.effectiveRate===null?'—':fmt.pct(r.effectiveRate/100)],
    ['Admin Fee (per payment)','—',r=>(r.adminFee>0)?fmt.currencyExact(r.adminFee)+'/'+freqLabel(r.freq):'—'],
    ['Total Interest Paid',fmt.currency(0),r=>fmt.currencyExact(r.totalInterest)],
    ['Total Admin Fees',fmt.currency(0),r=>fmt.currencyExact(r.totalAdminFee||0)],
    ['Total Fees Paid',fmt.currency(0),r=>fmt.currencyExact(r.totalFee)],
    ['Total Financing Cost',fmt.currency(0),r=>fmt.currencyExact(r.totalFinanceCost)],['Total Out-of-Pocket',fmt.currency(pc),r=>fmt.currencyExact(r.totalOOP)],
    // Every column is measured at its own horizon, so print that horizon and the
    // cash baseline that belongs to it. The cash column runs to the comparison
    // horizon (the longest scenario) to match the chart and the KPI tile; each
    // scenario column then reconciles against its own row:
    //   Ending Wealth − Cash Purchase at Same Horizon = Net Benefit.
    ['Comparison Horizon',horizonTxt(latestResults.maxTerm),r=>horizonTxt(r.termYears)],
    ['Ending Wealth',fmt.currencyExact(latestResults.cashBase.endWealth),r=>fmt.currencyExact(r.endWealth)],
    ['Cash Purchase at Same Horizon','Baseline',r=>fmt.currencyExact(r.cashBaseWealth)],
    ['Net Benefit vs Cash','Baseline',r=>{const v=snapNB(r.netBenefit);return`<span style="color:${v>0?cssVar('--positive-em'):v<0?cssVar('--negative-em'):cssVar('--text')};font-weight:700">${fmt.currencyExact(v)}</span>`;}],
  ];
  if(inflOn)rows.push(['Inflation-Adj Net Benefit','Baseline',r=>{if(!r.inflAdj||r.inflAdj.netBenefitReal===undefined)return'—';const v=snapNB(r.inflAdj.netBenefitReal);return`<span style="color:${v>0?cssVar('--positive-em'):v<0?cssVar('--negative-em'):cssVar('--text')};font-weight:700">${fmt.currencyExact(v)}</span>`;}]);
  // Rows that only earn their place when some scenario actually has the thing.
  const rowAt=lbl=>rows.findIndex(x=>x[0]===lbl);
  if(valid.some(r=>r.residualAmt>0))
    rows.splice(rowAt('Financed Amount')+1,0,['Residual / Balloon','—',r=>r.residualAmt>0?fmt.currencyExact(r.residualAmt):'—']);
  if(valid.some(r=>r.amort&&r.amort.schedule.length>1&&Math.abs(r.finalPayment-r.payment)>0.005))
    rows.splice(rowAt('Periodic Payment')+1,0,['Final Payment','—',r=>{
      const sch=r.amort&&r.amort.schedule;
      return(!sch||sch.length<2||Math.abs(r.finalPayment-r.payment)<=0.005)?'—':fmt.currencyExact(r.finalPayment);
    }]);
  // The midpoint stays in the Ending Wealth row above; the spread gets its own,
  // so every existing cell still reads as a single number.
  if(valid.some(r=>r.bandLo&&r.bandHi))
    rows.splice(rowAt('Ending Wealth')+1,0,['Ending Wealth Range (min–max)','—',r=>{
      if(!r.bandLo||!r.bandHi)return'—';
      const a=Math.min(r.bandLo.endWealth,r.bandHi.endWealth),b=Math.max(r.bandLo.endWealth,r.bandHi.endWealth);
      return fmt.currencyExact(a)+' – '+fmt.currencyExact(b);
    }]);
  rows.forEach(([label,cashVal,fn])=>{
    h+=`<tr><td>${label}</td><td>${cashVal}</td>`;valid.forEach(r=>{h+='<td>'+fn(r)+'</td>';});h+='</tr>';
  });
  h+='</tbody></table>';
  // Only worth saying when the columns really do end at different dates.
  const mixedHorizons=valid.some(r=>Math.abs(r.termYears-latestResults.maxTerm)>1e-9);
  if(mixedHorizons)h+='<p class="muted" style="margin-top:10px;font-size:.85rem;">These scenarios run for different lengths. The Cash Purchase column is shown at the longest horizon ('+horizonTxt(latestResults.maxTerm)+'), so each shorter scenario is scored against its own same-horizon cash row above, never against the column.</p>';
  $('compTableWrap').innerHTML=h;
}

function renderAmortTabs(results){
  const valid=results.filter(r=>r&&r.amort.schedule.length>0);const tb=$('amortTabs');tb.innerHTML='';
  if(!valid.length){$('amortTableWrap').innerHTML='<p class="muted">No financing scenarios with payments.</p>';return;}
  if(activeAmortIdx>=valid.length)activeAmortIdx=0;
  valid.forEach((r,i)=>{const b=document.createElement('button');b.className='tab-btn'+(i===activeAmortIdx?' active':'');b.textContent=r.name;b.addEventListener('click',()=>{activeAmortIdx=i;renderAmortTabs(results);});tb.appendChild(b);});
  const r=valid[activeAmortIdx];
  const periodHdr=freqLabel(r.freq).charAt(0).toUpperCase()+freqLabel(r.freq).slice(1)+' #';
  // The rate only earns a column where it actually moves, so a plain fixed-rate
  // loan (and the CSV scraped from it) is unchanged.
  const showRate=r.rateMode==='schedule';
  const COLS=showRate?7:6;
  let h='<table><thead><tr><th>'+periodHdr+'</th>'+(showRate?'<th>Rate (p.a.)</th>':'')+'<th>Start Balance</th><th>Interest</th><th>Principal</th><th>Payment</th><th>End Balance</th></tr></thead><tbody>';
  let tI=0,tP=0,tPmt=0;
  r.amort.schedule.forEach(p=>{tI+=p.interest;tP+=p.principal;tPmt+=p.payment;h+=`<tr><td>${fmt.num(p.num)}</td>${showRate?'<td>'+fmt.pct(periodRateToAnnualPct(p.rate,r.ppy)/100)+'</td>':''}<td>${fmt.currencyExact(p.startBal)}</td><td>${fmt.currencyExact(p.interest)}</td><td>${fmt.currencyExact(p.principal)}</td><td>${fmt.currencyExact(p.payment)}</td><td>${fmt.currencyExact(p.endBal)}</td></tr>`;});
  h+=`<tr style="font-weight:800;border-top:2px solid var(--accent);"><td>Total</td>${showRate?'<td></td>':''}<td></td><td>${fmt.currencyExact(tI)}</td><td>${fmt.currencyExact(tP)}</td><td>${fmt.currencyExact(tPmt)}</td><td></td></tr>`;
  if(r.fee>0)h+=`<tr><td colspan="${COLS}" style="text-align:left;color:var(--muted);">+ Origination Fee: ${fmt.currencyExact(r.fee)}${r.feeTreatment==='upfront'?'':' ('+(r.feeTreatment==='capitalise'?'added to the loan':'deducted from the advance')+', so it is repaid inside the payments above)'}</td></tr>`;
  if(r.totalAdminFee>0)h+=`<tr><td colspan="${COLS}" style="text-align:left;color:var(--muted);">+ Admin Fees: ${fmt.currencyExact(r.totalAdminFee)} (${fmt.num(r.amort.schedule.length)} × ${fmt.currencyExact(r.adminFee)}/${freqLabel(r.freq)})</td></tr>`;
  h+=`<tr><td colspan="${COLS}" style="text-align:left;color:var(--muted);">= Grand Total: ${fmt.currencyExact(tPmt+r.cashFee+r.totalAdminFee+r.down)} (incl. ${fmt.currencyExact(r.down)} down)</td></tr>`;
  h+='</tbody></table>';
  // The schedule can only show one rate path, so say which one it is.
  if(r.bandLo&&r.bandHi)h+='<p class="muted" style="margin-top:10px;font-size:.85rem;">This schedule follows the midpoint of the variable-rate range. The chart shades the full min to max span.</p>';
  $('amortTableWrap').innerHTML=h;
}

function updateSensScenarioDropdown(){const s=$('sensScenario'),p=s.value;s.innerHTML='';scenarios.forEach((sc,i)=>{const o=document.createElement('option');o.value=i;o.textContent=sc.name;s.appendChild(o);});if(p&&parseInt(p)<scenarios.length)s.value=p;updateSensTermLabels();}

// The "Term" sweep variable is expressed in the selected scenario's repayment
// periods (weeks/months/years) rather than a fixed unit of years.
function sensSelectedFreq(){const sc=scenarios[parseInt($('sensScenario').value)];return sc?sc.freq:'monthly';}
let sensTermFreq=null; // last frequency the term sweep range was built for
let sensScKind=null;   // last loan type + rate mode the sweep ranges were built for
function sensSelectedScenario(){return scenarios[parseInt($('sensScenario').value)]||null;}
function updateSensTermLabels(){
  const freq=sensSelectedFreq(),unit=termUnitLabel(freq);
  const xo=$('sensVarXTermOpt'),yo=$('sensVarYTermOpt');
  if(xo)xo.textContent='Term ('+unit+')';
  if(yo)yo.textContent='Term ('+unit+')';
  // Only offer a sweep the selected scenario can actually answer, and name the
  // rate sweep for what it does to a scheduled loan.
  const sc=sensSelectedScenario();
  const known=!!sc&&sc.loanType==='knownPayment',bal=!!sc&&sc.loanType==='balloon';
  const shift=!!sc&&sc.rateMode==='schedule';
  [['sensVarXPayOpt','sensVarX'],['sensVarYPayOpt','sensVarY']].forEach(([oid,sid])=>{
    const o=$(oid);if(!o)return;o.hidden=!known;o.disabled=!known;
    if(!known&&$(sid).value==='payment')$(sid).value=sid==='sensVarX'?'financeRate':'riskFreeRate';
  });
  [['sensVarXResOpt','sensVarX'],['sensVarYResOpt','sensVarY']].forEach(([oid,sid])=>{
    const o=$(oid);if(!o)return;o.hidden=!bal;o.disabled=!bal;
    if(!bal&&$(sid).value==='residual')$(sid).value=sid==='sensVarX'?'financeRate':'riskFreeRate';
  });
  [['sensVarXRateOpt','sensVarX'],['sensVarYRateOpt','sensVarY']].forEach(([oid,sid])=>{
    const o=$(oid);if(!o)return;
    o.textContent=shift?'Rate Shift (pp)':'Finance Rate (%)';
    o.hidden=known;o.disabled=known;
    if(known&&$(sid).value==='financeRate')$(sid).value=sid==='sensVarX'?'payment':'riskFreeRate';
  });
  // Switching to a scenario of a different shape makes the old range
  // meaningless (a 1 to 10 sweep of a repayment amount says nothing), so
  // re-seed both axes whenever that shape changes.
  const kind=(sc?sc.loanType:'')+'|'+(sc?sc.rateMode:'');
  if(kind!==sensScKind){
    sensScKind=kind;
    const[xa,xb]=defaultAxisRange($('sensVarX').value,freq,sc);$('sensXStart').value=xa;$('sensXEnd').value=xb;
    const[ya,yb]=defaultAxisRange($('sensVarY').value,freq,sc);$('sensYStart').value=ya;$('sensYEnd').value=yb;
  }
  // A range of 12–84 means months for a monthly loan and years for a yearly
  // one, so re-seed it whenever the selected scenario's unit changes.
  if(freq!==sensTermFreq){
    sensTermFreq=freq;const[a,b]=defaultAxisRange('term',freq,sc);
    if($('sensVarX').value==='term'){$('sensXStart').value=a;$('sensXEnd').value=b;}
    if($('sensVarY').value==='term'){$('sensYStart').value=a;$('sensYEnd').value=b;}
  }
}
function defaultAxisRange(vn,freq,sc){
  if(vn==='term')return{weekly:[52,364],fortnightly:[26,182],monthly:[12,84],yearly:[1,10]}[freq]||[12,84];
  // A scheduled loan has no single rate to sweep, so the sweep shifts every
  // period together and the range is a shift in percentage points, not a level.
  if(vn==='financeRate')return(sc&&sc.rateMode==='schedule')?[-2,4]:[1,10];
  if(vn==='riskFreeRate')return[1,8];
  if(vn==='downPayment')return[0,50];
  if(vn==='residual')return[0,60];
  if(vn==='payment'){const b=sc?Math.max(1,Math.round((sc.knownPayment||0))):1;return[Math.round(b*0.6),Math.round(b*1.6)||10];}
  return[1,10];
}

/* ─── Sensitivity Engine ─── */
/* ── The sensitivity sweep ──────────────────────────────────────────────────
   No Run button. A 50-point 2D sweep costs about 1ms and the 50x50 surface
   about 9ms, so there is nothing here worth making the reader ask for — the
   sweep just follows its inputs like every other output on the page. The
   debounce is only there to keep a held arrow key from redrawing the Plotly
   surface once per repeat. */
let sensTimer=null;
function scheduleSensitivity(){clearTimeout(sensTimer);sensTimer=setTimeout(runSensitivity,180);}

function runSensitivity(){
  const scIdx=parseInt($('sensScenario').value);if(isNaN(scIdx)||!scenarios[scIdx])return;
  const baseSc={...scenarios[scIdx]};const obj=$('sensObjective').value;const varX=$('sensVarX').value;
  const xS=parseFloat($('sensXStart').value)||0,xE=parseFloat($('sensXEnd').value)||10;
  const steps=Math.max(5,Math.min(50,parseInt($('sensSteps').value)||20));
  // Read the same inputs, the same way, as the main panel: never substitute a
  // price of our own, and honour the "must be affordable upfront" guard.
  const pc=Math.max(0,parseNumInput($('purchaseCost'))),ac=Math.max(0,parseNumInput($('availableCash')));
  const blocked=pc<=0?'Enter a purchase cost to run a sweep.'
    :ac<=0?'Enter your available cash to run a sweep.'
    :ac<pc?'Available cash is below the purchase cost, so there is nothing to sweep.':'';
  const inflOn=$('inflationToggle').checked,inflR=parseFloat($('inflationRate').value)||0;
  const rfRate=parseFloat($('baseRf').value)||0;

  function applyVar(sc,vn,val){
    const m={...sc};
    if(vn==='financeRate'){
      if(m.rateMode==='schedule'&&Array.isArray(m.ratePeriods)){
        // No single rate exists to set, so shift the whole schedule in
        // percentage points: a rate shock, which is the useful sweep anyway.
        m.ratePeriods=m.ratePeriods.map(p=>Object.assign({},p,{
          rate:Math.max(0,(Number(p.rate)||0)+val),
          rateMin:Math.max(0,(Number(p.rateMin)||0)+val),
          rateMax:Math.max(0,(Number(p.rateMax)||0)+val)}));
      } else m.financeRate=val;
    }
    else if(vn==='riskFreeRate'){/* now a global, override via closure */m._rfOverride=val;}
    else if(vn==='downPayment')m.downPaymentPct=Math.min(100,Math.max(0,val));
    else if(vn==='term'){
      m.termPeriods=Math.max(1,Math.round(val));
      // The interest-only span cannot outlast the loan it sits inside.
      if(m.ioPeriods!==undefined)m.ioPeriods=Math.min(m.termPeriods,m.ioPeriods);
    }
    else if(vn==='payment')m.knownPayment=Math.max(0,val);
    else if(vn==='residual')m.residualPct=Math.min(99,Math.max(0,val));
    return m;
  }
  function getNetBenefit(m,pc,ac,inflR,inflOn,obj){
    const rf=m._rfOverride!==undefined?m._rfOverride:rfRate;
    return quickNetBenefit(m,pc,ac,rf,inflR,inflOn,obj);
  }
  const xVals=[];for(let i=0;i<steps;i++)xVals.push(xS+i*(xE-xS)/(steps-1));

  if(sensMode==='2d'){
    $('sens2dSection').style.display='';$('sens3dSection').style.display='none';
    const objL=$('sensObjective').selectedOptions[0].text,xL=$('sensVarX').selectedOptions[0].text;
    $('sens2dTitle').textContent=`${objL} vs ${xL}`;
    // An infeasible point (down payment + fee exceeds available cash) has no
    // net benefit at all: plot NaN so Chart.js breaks the line instead of
    // drawing a break-even $0 that never happens.
    const data=xVals.map(x=>{if(blocked)return null;const m=applyVar(baseSc,varX,x);const v=getNetBenefit(m,pc,ac,inflR,inflOn,obj);return v===null?NaN:v;});
    const labels=xVals.map(x=>x.toFixed(2));const color=scenarioColor(scenarios[scIdx],scIdx);
    const gc=cssVar('--chart-grid'),mc=cssVar('--chart-text');
    const datasets=[{label:objL,data,borderColor:color,backgroundColor:color+'22',borderWidth:2.5,pointRadius:2,pointHoverRadius:5,tension:.3,fill:false},{label:'Zero',data:xVals.map(()=>0),borderColor:cssVar('--muted'),borderWidth:1,borderDash:[4,4],pointRadius:0,fill:false}];
    const sensLe=$('sensLegend'); sensLe.innerHTML='';
    if(blocked){
      const b=document.createElement('div'); b.className='legend-item'; b.style.color='var(--muted)';
      b.textContent=blocked; sensLe.appendChild(b);
    } else {
      // The objective line, plus the dashed zero rule it is read against.
      sensLe.appendChild(SharedLegend.item(SharedLegend.fromDataset(datasets[0]), baseSc.name));
      sensLe.appendChild(SharedLegend.item(SharedLegend.fromDataset(datasets[1]), 'Break-even (zero)'));
    }
    const cfg={type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:SharedChartTip.options({callbacks:{title:c=>`${xL}: ${c[0].label}`,label:c=>Number.isFinite(c.parsed.y)?`${c.dataset.label}: ${fmt.currency(c.parsed.y,true)}`:`${c.dataset.label}: not feasible`}}),zoom:SharedZoom.options({min:0,max:labels.length-1,points:labels.length}),sharedYFit:{auto:{axes:['y']}}},scales:{x:{title:{display:true,text:xL,color:mc},ticks:{color:mc,font:{size:11}},grid:{color:gc}},y:{title:{display:true,text:objL,color:mc},ticks:{color:mc,font:{size:11},callback:v=>fmt.currency(v,true)},grid:{color:gc}}}}};
    if(sensChartInstance){sensChartInstance.data=cfg.data;sensChartInstance.options=cfg.options;sensChartInstance.update('none');}
    else sensChartInstance=new Chart($('sensCanvas'),{...cfg,plugins:[SharedZoom.plugin]});
  } else {
    // ═══ 3D SURFACE PLOT ═══
    $('sens2dSection').style.display='none';$('sens3dSection').style.display='';
    if(blocked){const el=$('plotly3d');if(el)el.innerHTML=`<p class="muted" style="padding:20px;text-align:center;">${blocked}</p>`;return;}
    const varY=$('sensVarY').value;
    const yS=parseFloat($('sensYStart').value)||0,yE=parseFloat($('sensYEnd').value)||8;
    const yVals=[];for(let i=0;i<steps;i++)yVals.push(yS+i*(yE-yS)/(steps-1));
    const xL=$('sensVarX').selectedOptions[0].text,yL=$('sensVarY').selectedOptions[0].text,zL=$('sensObjective').selectedOptions[0].text;
    $('sens3dTitle').textContent=`3D Surface: ${zL}`;

    // Build z matrix [y][x]
    const zData=[];
    for(let yi=0;yi<steps;yi++){const row=[];for(let xi=0;xi<steps;xi++){let m=applyVar(baseSc,varX,xVals[xi]);m=applyVar(m,varY,yVals[yi]);const v=getNetBenefit(m,pc,ac,inflR,inflOn,obj);row.push(v);}zData.push(row);} // null = infeasible, Plotly leaves a hole

    const isLight=document.body.classList.contains('light');
    const plotData=[{type:'surface',x:xVals,y:yVals,z:zData,
      colorscale:[[0,'#E63939'],[0.25,'#FFD28C'],[0.5,'#F8FBFF'],[0.75,'#8FCDBD'],[1,'#8DBBFF']],
      contours:{z:{show:true,usecolormap:true,highlightcolor:'#fff',project:{z:false}}},
      hovertemplate:`${xL}: %{x:.2f}<br>${yL}: %{y:.2f}<br>${zL}: ${moneySymbol()}%{z:,.0f}<extra></extra>`
    }];
    const layout={autosize:true,margin:{l:0,r:0,t:0,b:0},
      paper_bgcolor:isLight?'#FFFFFF':'#162033',
      scene:{
        xaxis:{title:xL,color:isLight?'#2D3436':'#A8B6CF',gridcolor:isLight?'#E0E6F0':'#2C3A52'},
        yaxis:{title:yL,color:isLight?'#2D3436':'#A8B6CF',gridcolor:isLight?'#E0E6F0':'#2C3A52'},
        zaxis:{title:zL,color:isLight?'#2D3436':'#A8B6CF',gridcolor:isLight?'#E0E6F0':'#2C3A52',tickprefix:moneySymbol(),tickformat:',.0f'},
        bgcolor:isLight?'#F0F4FF':'#0F1728',
        camera:{eye:{x:1.8,y:1.8,z:1.2}}
      },
      font:{family:'DM Sans',color:isLight?'#2D3436':'#EAF1FF'}
    };
    // react(), not newPlot(): the surface is redrawn as the reader types now, and
    // uirevision tells Plotly the view is the same one, so the camera angle they
    // set survives the redraw instead of snapping back to the default eye.
    layout.uirevision='sens';
    ensurePlotly()
      .then(()=>Plotly.react('plotly3d',plotData,layout,{responsive:true,displayModeBar:true,displaylogo:false}))
      .catch(()=>{ const el=$('plotly3d'); if(el) el.innerHTML='<p class="muted" style="padding:20px;text-align:center;">Could not load the 3D plotting library (Plotly). Check your connection and try again.</p>'; });
  }
}

/* Lazy-load Plotly on first 3D-surface use so the ~3.5 MB library never blocks
   the initial page load (it is only needed for the optional 3D sensitivity view). */
let _plotlyPromise=null;
function ensurePlotly(){
  if(window.Plotly) return Promise.resolve();
  if(_plotlyPromise) return _plotlyPromise;
  _plotlyPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.plot.ly/plotly-2.27.0.min.js';
    s.onload=()=>resolve();
    s.onerror=()=>{ _plotlyPromise=null; reject(new Error('Failed to load Plotly')); };
    document.head.appendChild(s);
  });
  return _plotlyPromise;
}

/* ─── Scenario Management ─── */
// A scheduled loan has no single headline rate, so the card shows the span it
// actually runs across instead of a number that is only true for part of it.
function scSummaryRate(sc){
  if(sc.loanType==='knownPayment')return 'rate solved';
  const norm=scenarioRateNorm(sc);
  let lo=Infinity,hi=-Infinity;
  norm.forEach(p=>{lo=Math.min(lo,p.min);hi=Math.max(hi,p.max);});
  if(!isFinite(lo))return fmt.pct((sc.financeRate||0)/100)+' rate';
  return (Math.abs(hi-lo)<1e-9?fmt.pct(lo/100):fmt.pct(lo/100)+'–'+fmt.pct(hi/100))+' rate';
}
/* ─── Scenario colour ───────────────────────────────────────────────────────
   One entry point for both swatches (the dot on the card and the box in the
   editor) so they cannot drift apart. A native colour input fires `input`
   continuously while the picker is dragged, so the live path only repaints the
   chart on a short timer; `change`, fired once when the picker closes, commits
   and saves. */
let colorTimer=null;
function applyScenarioColor(idx,hex,live){
  const sc=scenarios[idx];if(!sc)return;
  sc.color=isHexColor(hex)?hex:null;
  const shown=scenarioColor(sc,idx);
  // Mirror the value into whichever swatch did not originate the edit. Setting
  // it on the source input too is harmless and keeps a reset in sync.
  const dot=document.querySelector('.sc-dot[data-idx="'+idx+'"]');
  if(dot&&dot.value!==shown)dot.value=shown;
  if(editingIdx===idx){
    const box=$('scColor');if(box&&box.value!==shown)box.value=shown;
  }
  if(live){clearTimeout(colorTimer);colorTimer=setTimeout(rerender,120);return;}
  clearTimeout(colorTimer);
  rerender();
  if(persist)persist.schedule();
}
// Back to the palette slot for this position, which also restores the
// theme-aware colour a literal hex would otherwise freeze.

function renderScenarioList(){
  const list=$('scenarioList');list.innerHTML='';
  scenarios.forEach((sc,i)=>{
    const div=document.createElement('div');div.className='scenario-card'+(editingIdx===i?' active':'');const color=scenarioColor(sc,i);
    div.innerHTML=`<div class="sc-header"><div class="sc-name"><input type="color" class="sc-dot" data-idx="${i}" value="${color}" title="Click to change this scenario's colour" aria-label="Colour for ${sc.name}"/>${sc.name}</div><div class="sc-actions"><button class="sc-btn" data-action="edit" data-idx="${i}" title="Edit">✎</button><button class="sc-btn" data-action="dup" data-idx="${i}" title="Duplicate">⧉</button><button class="sc-btn del" data-action="del" data-idx="${i}" title="Delete">✕</button></div></div><div class="sc-summary">${scSummaryRate(sc)} · ${sc.termPeriods} ${termUnitLabel(sc.freq)} ${sc.freq} · ${fmt.pct((sc.downPaymentPct||0)/100,0)} down${(sc.loanType&&sc.loanType!=='annuity')?' · '+LOAN_TYPE_LABEL[sc.loanType]:''}${scenarioHasFloat(sc)?' · variable':''}</div>`;
    div.querySelectorAll('.sc-btn').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();const a=btn.dataset.action,idx=parseInt(btn.dataset.idx);if(a==='edit')openEditor(idx);else if(a==='dup'){scenarios.push({...scenarios[idx],name:scenarios[idx].name+' (copy)',color:null});renderScenarioList();rerender();}else if(a==='del'){scenarios.splice(idx,1);if(editingIdx===idx){editingIdx=-1;$('scenarioEditor').style.display='none';}renderScenarioList();rerender();}});});
    const dot=div.querySelector('.sc-dot');
    // The dot sits inside the card, whose own click opens the editor; without
    // this the swatch would open the editor before the colour picker appeared.
    dot.addEventListener('click',e=>e.stopPropagation());
    dot.addEventListener('input',e=>{e.stopPropagation();applyScenarioColor(+dot.dataset.idx,e.target.value,true);});
    dot.addEventListener('change',e=>{e.stopPropagation();applyScenarioColor(+dot.dataset.idx,e.target.value,false);});
    div.addEventListener('click',()=>openEditor(i));list.appendChild(div);
  });
  if(persist) persist.schedule(); // scenarios are JS state — save on every change
}

function updateTermLabel(freq){
  const unit=termUnitLabel(freq);
  // Update the label text node (first child of tip-wrap)
  const lbl=$('termLabel');
  lbl.firstChild.textContent='Term ('+unit+') ';
  const sub=$('termSub');
  if(freq==='weekly')sub.textContent='Number of weekly payments (e.g. 260 = 5 years).';
  else if(freq==='fortnightly')sub.textContent='Number of fortnightly payments (e.g. 130 = 5 years).';
  else if(freq==='monthly')sub.textContent='Number of monthly payments (e.g. 60 = 5 years).';
  else sub.textContent='Number of yearly payments (e.g. 5 = 5 years).';
}

/* ─── Loan type, rate schedule and repayment schedule (editor) ─────────────
   The editor holds a DRAFT of the two schedules while it is open, so Cancel
   really cancels. Everything else stays on the form controls, as before. */
let editorDraft=null;
function show(id,on){const el=$(id);if(el)el.style.display=on?'':'none';}
function editorLoanType(){return $('scLoanType').value||'annuity';}
function editorTerm(){return Math.max(1,Math.round(parseFloat($('scTerm').value)||defaultTerm(editorTermFreq)));}
function editorIoPeriods(){const v=parseFloat($('scIoPeriods').value);return isFinite(v)?Math.max(0,Math.round(v)):0;}
// The repayment each schedule's first row opens on. A rate schedule on a
// deferred start begins at the first instalment after the payment holiday,
// because there is no repayment inside the holiday for a rate to be quoted
// against; everything else opens on repayment 1.
function schedStart(kind){
  return kind==='rate'
    ?rateScheduleStart({loanType:editorLoanType(),ioPeriods:editorIoPeriods()},editorTerm())
    :1;
}
function schedList(kind){return kind==='rate'?editorDraft.ratePeriods:editorDraft.paymentPeriods;}
function schedWrapId(kind){return kind==='rate'?'scRatePeriodRows':'scPaymentPeriodRows';}

// Seeded so that switching to Schedule shows the idea rather than a blank list:
// fixed for the first fifth of the term, floating after, which is the shape of
// a fixed-then-variable loan.
function defaultRatePeriods(term,rate,start){
  const r=Number(rate)||5;
  const s=Math.max(1,Math.min(term,Math.round(start||1)));
  const span=term-s+1; // the repayments the schedule actually covers
  if(span<=2)return[{toPeriod:term,type:'floating',rate:r,rateMin:r,rateMax:r+3}];
  const cut=Math.max(s,Math.min(term-1,s-1+Math.round(span/5)));
  return[{toPeriod:cut,type:'fixed',rate:r,rateMin:r,rateMax:r},
         {toPeriod:term,type:'floating',rate:r+1.5,rateMin:r,rateMax:r+3}];
}
function defaultPaymentPeriods(term,amt){
  const a=Math.max(0,Number(amt)||0);
  if(term<=2)return[{toPeriod:term,amount:a}];
  const cut=Math.max(1,Math.min(term-1,Math.round(term/5)));
  return[{toPeriod:cut,amount:Math.round(a*0.6)},{toPeriod:term,amount:a}];
}
// What a plain amortizing loan would charge, so the repayment field never opens
// on a zero that no rate can solve.
function suggestedPayment(){
  const pc=Math.max(0,parseNumInput($('purchaseCost')));
  const downPct=Math.min(100,Math.max(0,parseFloat($('scDownPct').value)||0));
  const base=pc-pc*(downPct/100);
  const ppy=periodsPerYear(editorTermFreq);
  const r=toPeriodRate(parseFloat($('scRate').value)||5,ppy);
  return Math.max(0,Math.round(annuityPmt(base,r,editorTerm())*100)/100);
}

function buildSchedRow(kind,p,idx,len){
  const row=document.createElement('div');
  row.className='sched-row';row.dataset.idx=idx;
  const isLast=idx===len-1;
  const unitCap=freqLabel(editorTermFreq).charAt(0).toUpperCase()+freqLabel(editorTermFreq).slice(1);
  // The last period always stretches to the term, so its end is read-only text;
  // every other period ends where the reader types, inside the range itself.
  const end=isLast
    ?'<b class="sp-to-lbl">1</b>'
    :'<input type="number" class="sp-to" min="1" step="1" value="'+p.toPeriod+'" aria-label="Last '+freqLabel(editorTermFreq)+' of this period" title="Last '+freqLabel(editorTermFreq)+' of this period"/>';
  const del='<button type="button" class="btn-secondary btn-sm btn-icon sp-delete"'+(len<=1?' disabled':'')+' aria-label="Delete period" title="Delete period">✕</button>';
  const head='<div class="sp-head"><span class="sp-range">'+unitCap+' <b class="sp-from">1</b><span class="sp-sep">–</span>'+end+'</span>';
  if(kind==='rate'){
    const f=p.type==='floating';
    row.innerHTML=head+
      '<select class="sel-input sp-type" aria-label="Rate type"><option value="fixed"'+(f?'':' selected')+'>Fixed</option><option value="floating"'+(f?' selected':'')+'>Floating</option></select>'+
      del+'</div><div class="sp-vals">'+
      '<span class="sp-fixed-wrap"'+(f?' style="display:none"':'')+'><input type="number" class="sp-rate" min="0" max="40" step="0.01" value="'+p.rate+'" aria-label="Rate"/><span class="sp-unit">% p.a.</span></span>'+
      '<span class="sp-float-wrap"'+(f?'':' style="display:none"')+'><input type="number" class="sp-min" min="0" max="40" step="0.01" value="'+p.rateMin+'" aria-label="Minimum rate"/><span class="sp-dash">–</span><input type="number" class="sp-max" min="0" max="40" step="0.01" value="'+p.rateMax+'" aria-label="Maximum rate"/><span class="sp-unit">% p.a.</span></span>'+
      '</div>';
  } else {
    row.innerHTML=head+del+'</div><div class="sp-vals">'+
      '<span class="sp-amt-wrap"><span class="sp-unit">'+moneySymbol()+'</span><input type="text" inputmode="decimal" class="sp-amt" value="'+fmt.fmtInput(p.amount)+'" aria-label="Repayment amount"/></span></div>';
  }
  return row;
}
function renderSchedRows(kind){
  if(!editorDraft)return;
  const wrap=$(schedWrapId(kind));if(!wrap)return;
  const list=schedList(kind)||[];
  wrap.innerHTML='';
  list.forEach((p,i)=>wrap.appendChild(buildSchedRow(kind,p,i,list.length)));
  syncSchedLabels(kind);
}
// The first period of each row is DERIVED, never typed, and the last row always
// stretches to the term, so a gap or an overlap cannot be entered at all.
function syncSchedLabels(kind){
  if(!editorDraft)return;
  const wrap=$(schedWrapId(kind));if(!wrap)return;
  const list=schedList(kind)||[];const term=editorTerm();
  let from=schedStart(kind);
  [...wrap.querySelectorAll('.sched-row')].forEach((row,i)=>{
    const isLast=i===list.length-1;
    const to=isLast?term:Math.min(term,Math.max(from,Math.round(Number(list[i].toPeriod)||from)));
    const a=row.querySelector('.sp-from'),b=row.querySelector('.sp-to-lbl');
    if(a)a.textContent=from;if(b)b.textContent=to;
    row.classList.toggle('sp-beyond',from>term);
    from=to+1;
  });
}
/* Moving where a schedule opens can strand a row that ends before its own first
   period — a payment holiday extended past a boundary the reader had already
   typed. normaliseRatePeriods() clamps those rows when the loan is built, so
   they are clamped here too: the rows on screen say what the loan will actually
   be built from, rather than printing a range that runs backwards. Only a
   change of loan type, holiday or term gets here, never a keystroke inside the
   rows themselves, so nothing is rewritten under the reader's cursor. */
function clampSchedToStart(kind){
  if(!editorDraft)return;
  const list=schedList(kind);if(!list||!list.length)return;
  const term=editorTerm();let from=schedStart(kind),changed=false;
  // A holiday that leaves a single repayment has no boundaries to speak of, and
  // rewriting every row to that one period would throw away what the reader
  // typed for a term they are still editing. The loan is built from one band
  // either way, so the rows are left as they are and only relabelled.
  if(term-from+1<=1){syncSchedLabels(kind);return;}
  // A band that ends before the schedule opens covers no repayment at all: the
  // holiday swallowed it whole. It is dropped rather than squeezed into a stub
  // of one period, so the loan opens on the band that does carry repayments.
  // The last band is never dropped — it is the one that stretches to the term.
  while(list.length>1&&Math.round(Number(list[0].toPeriod)||0)<from){list.shift();changed=true;}
  list.forEach((p,i)=>{
    const isLast=i===list.length-1;
    const want=isLast?term:Math.min(term,Math.max(from,Math.round(Number(p.toPeriod)||from)));
    if(!isLast&&Math.round(Number(p.toPeriod)||0)!==want){p.toPeriod=want;changed=true;}
    from=want+1;
  });
  if(changed)renderSchedRows(kind);else syncSchedLabels(kind);
}
function readSchedFromDOM(kind){
  if(!editorDraft)return;
  const wrap=$(schedWrapId(kind));if(!wrap)return;
  const rows=[...wrap.querySelectorAll('.sched-row')];
  if(!rows.length)return;
  const term=editorTerm();
  const out=rows.map(row=>{
    const toEl=row.querySelector('.sp-to');
    const toPeriod=toEl?Math.max(1,Math.round(parseFloat(toEl.value)||term)):term;
    if(kind==='rate')return{toPeriod,
      type:row.querySelector('.sp-type').value==='floating'?'floating':'fixed',
      rate:parseFloat(row.querySelector('.sp-rate').value)||0,
      rateMin:parseFloat(row.querySelector('.sp-min').value)||0,
      rateMax:parseFloat(row.querySelector('.sp-max').value)||0};
    return{toPeriod,amount:Math.max(0,parseNumInput(row.querySelector('.sp-amt')))};
  });
  if(kind==='rate')editorDraft.ratePeriods=out;else editorDraft.paymentPeriods=out;
}
function addSchedPeriod(kind){
  if(!editorDraft)return;
  readSchedFromDOM(kind);
  const list=schedList(kind),term=editorTerm(),start=schedStart(kind);
  if(!list||term-start+1<=list.length)return; // no room left to split
  const prevTo=list.length>1?Math.round(Number(list[list.length-2].toPeriod)||0):start-1;
  const cut=Math.min(term-1,Math.max(prevTo+1,Math.round((prevTo+term)/2)));
  const last=list[list.length-1];
  list.splice(list.length-1,0,kind==='rate'
    ?{toPeriod:cut,type:last.type,rate:last.rate,rateMin:last.rateMin,rateMax:last.rateMax}
    :{toPeriod:cut,amount:last.amount});
  renderSchedRows(kind);
  if(kind==='payment')updateImpliedRate();
}
function syncSegGroups(){
  if(!editorDraft)return;
  document.querySelectorAll('#scRateModeGroup .seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===editorDraft.rateMode));
  document.querySelectorAll('#scPaymentModeGroup .seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===editorDraft.paymentMode));
}

/* ─── Editor layout ────────────────────────────────────────────────────────
   The editor is not one long list of fields. It is five titled sections, and
   their order is a DEPENDENCY order: whatever decides what a later field is
   allowed to say sits above it. The loan type and the shape parameter that type
   brings with it come first, then the term those periods are counted in, then
   the price, then the cash side of the deal.

   A known repayment inverts the last two, and that is the whole reason the
   order is a table rather than the markup: its rate is not typed at all, it is
   SOLVED from the plan against the amount financed, so the down payment and the
   fees have to be settled before the section that is priced from them.

   Each section owns a fixed set of rows, so a type's layout is one line here
   rather than a second copy of the form. updateEditorVisibility() decides which
   ROWS a type shows; a section whose rows are all hidden hides with them, which
   is what lets one table serve all seven types. */
const EDITOR_SECTIONS={
  structure:['scLoanTypeRow','scIoPeriodsRow','scResidualRow'],
  term:['scFreqRow','scTermRow'],
  rate:['scRateModeRow','scRateBlock','scRateScheduleRow'],
  plan:['scPaymentModeRow','scKnownPaymentRow','scPaymentScheduleRow','scImpliedRateRow'],
  cash:['scDownRow','scFeeRow','scFeeTreatmentRow','scAdminFeeRow'],
};
function editorSectionPlan(t){
  const title={
    structure:'Loan Structure',
    term:'Repayment Term',
    // A flat loan fixes its interest at the outset on the original principal,
    // so the section is not offering a rate that can move.
    rate:t==='flat'?'Flat Rate':'Interest Rate',
    plan:'Repayment Plan',
    cash:'Upfront & Fees',
  };
  // A note only where the order itself needs explaining, never as decoration.
  const note={};
  if(t==='knownPayment')
    note.cash='Set these first: they fix the amount financed, and the rate below is solved against it.';
  if(t==='deferred'&&editorDraft&&editorDraft.rateMode==='schedule')
    note.rate='Counted from the first repayment after the payment holiday, not from repayment 1.';
  const order=t==='knownPayment'
    ?['structure','term','cash','plan','rate']
    :['structure','term','rate','plan','cash'];
  return order.map(key=>({key,title:title[key],note:note[key]||'',ids:EDITOR_SECTIONS[key]}));
}
/* Build the sections and put the rows in them. Nothing is created twice and
   nothing is moved unless the order actually changed, so a layout that is
   already right costs one comparison and never steals focus from the field the
   reader is typing in. */
function applyEditorLayout(){
  const host=$('scFields');if(!host)return;
  const plan=editorSectionPlan(editorLoanType());
  const groups=plan.map(sec=>{
    let g=$('scSec-'+sec.key);
    if(!g){
      g=document.createElement('div');g.className='field-group';g.id='scSec-'+sec.key;
      g.innerHTML='<div class="group-title"></div><div class="field-sub sec-note"></div>';
      // Attached before any row moves into it, so a row never leaves the
      // document and getElementById can still find it on the next pass.
      host.appendChild(g);
    }
    const head=g.querySelector('.group-title'),note=g.querySelector('.sec-note');
    head.textContent=sec.title;
    note.textContent=sec.note;note.style.display=sec.note?'':'none';
    const want=sec.ids.map(id=>$(id)).filter(Boolean);
    const have=[...g.children].filter(el=>el!==head&&el!==note);
    if(have.length!==want.length||have.some((el,i)=>el!==want[i]))want.forEach(el=>g.appendChild(el));
    g.style.display=want.some(el=>el.style.display!=='none')?'':'none';
    return g;
  });
  const have=[...host.children];
  if(have.length!==groups.length||have.some((el,i)=>el!==groups[i]))groups.forEach(g=>host.appendChild(g));
}

/* Exactly one segmented control and at most one extra field group is ever on
   screen, so picking a loan type never stacks a second way to say the same
   thing on top of the first. */
function updateEditorVisibility(){
  if(!editorDraft)return;
  const t=editorLoanType();
  const canSched=supportsSchedule(t);
  const sched=canSched&&editorDraft.rateMode==='schedule';
  const known=t==='knownPayment';
  const paySched=known&&editorDraft.paymentMode==='schedule';
  show('scRateModeRow',canSched);
  show('scRateBlock',!known&&!sched);
  show('scRateScheduleRow',sched);
  show('scPaymentModeRow',known);
  show('scKnownPaymentRow',known&&!paySched);
  show('scPaymentScheduleRow',paySched);
  show('scImpliedRateRow',known);
  show('scIoPeriodsRow',usesIoPeriods(t));
  show('scResidualRow',t==='balloon');
  const unit=termUnitLabel(editorTermFreq);
  const rl=$('scRateLabel');
  if(rl&&rl.firstChild)rl.firstChild.textContent=(t==='flat'?'Flat Rate (annual %) ':t==='bullet'?'Interest Rate (annual %) ':'Finance Rate (annual %) ');
  const il=$('scIoLabel');
  if(il&&il.firstChild)il.firstChild.textContent=(t==='deferred'?'Payment Holiday ('+unit+') ':'Interest-Only ('+unit+') ');
  const isub=$('scIoSub');
  if(isub)isub.textContent=t==='deferred'
    ?'Repayments start after this many '+unit+'. Interest is added to the debt meanwhile.'
    :'Set this to the full term to repay the principal in one lump at the end.';
  // The loan type decides where the rate schedule opens, so the ranges printed
  // on its rows are re-derived here rather than only when the term is edited.
  clampSchedToStart('rate');
  // Which rows are on screen is settled above, so the sections can now be put
  // in this type's order and the empty ones folded away.
  applyEditorLayout();
}

function updateImpliedRate(){
  const el=$('scImpliedRate');
  if(!el||!editorDraft||editorLoanType()!=='knownPayment')return;
  el.classList.remove('unsolved');
  const pc=Math.max(0,parseNumInput($('purchaseCost')));
  const downPct=Math.min(100,Math.max(0,parseFloat($('scDownPct').value)||0));
  const base=pc-pc*(downPct/100);
  const sc=editorScenarioDraft();
  const fin=resolveFinancing(sc,base);
  if(!fin||base<=0){el.textContent='—';return;}
  const r=solvePeriodRate(fin.financed,scenarioPaymentStream(sc,editorTerm()));
  if(r===null){
    el.classList.add('unsolved');
    el.textContent='No rate repays this loan. Raise the repayment or shorten the term.';
    return;
  }
  const ann=effectiveAnnual(r,periodsPerYear(editorTermFreq));
  el.textContent=fmt.pct(ann/100)+' p.a.'+(ann<0?' (you repay less than you borrow)':'');
}

// The whole scenario as the editor currently reads. Save writes this; the
// implied-rate readout previews it.
function editorScenarioDraft(){
  const t=editorLoanType();
  const rate=parseFloat($('scRate').value);
  return{
    name:$('scName').value||'Scenario',
    // The colour is applied live by the swatches, not read off the form, so a
    // save must carry forward whatever the scenario already holds.
    color:(editingIdx>=0&&scenarios[editingIdx])?(scenarios[editingIdx].color||null):null,
    financeRate:isNaN(rate)?5:rate,
    downPaymentPct:Math.min(100,Math.max(0,parseFloat($('scDownPct').value)||0)),
    termPeriods:editorTerm(),freq:editorTermFreq,
    feeAmt:Math.max(0,parseNumInput($('scFeeAmt'))),
    feeType:$('scFeeType').value,
    feeTreatment:$('scFeeTreatment').value,
    adminFee:Math.max(0,parseNumInput($('scAdminFee'))),
    loanType:t,
    rateMode:supportsSchedule(t)?editorDraft.rateMode:'simple',
    ratePeriods:editorDraft.ratePeriods,
    paymentMode:t==='knownPayment'?editorDraft.paymentMode:'single',
    paymentPeriods:editorDraft.paymentPeriods,
    knownPayment:Math.max(0,parseNumInput($('scKnownPayment'))),
    ioPeriods:Math.max(0,Math.round(parseFloat($('scIoPeriods').value)||0)),
    residualPct:Math.min(99,Math.max(0,parseFloat($('scResidualPct').value)||0)),
  };
}

function openEditor(idx){
  editingIdx=idx;const sc=scenarios[idx];
  if(sc.downPaymentPct===undefined&&sc.downPayment!==undefined){
    sc.downPaymentPct=Math.min(100,Math.max(0,(sc.downPayment/(parseNumInput($('purchaseCost'))||1))*100));
  }
  $('editorTitle').textContent='Edit: '+sc.name;
  $('scName').value=sc.name;
  $('scColor').value=scenarioColor(sc,idx);
  $('scRate').value=sc.financeRate;
  $('scRateVal').textContent=fmt.pct(sc.financeRate/100);
  $('scDownPct').value=Math.min(100,Math.max(0,sc.downPaymentPct||0));
  $('scDownVal').textContent=fmt.pct(($('scDownPct').value||0)/100,0);
  $('scTerm').value=sc.termPeriods;
  $('scFreq').value=sc.freq;
  editorTermFreq=sc.freq;
  updateTermLabel(sc.freq);
  $('scFeeAmt').value=fmt.fmtInput(sc.feeAmt);
  $('scFeeType').value=sc.feeType;
  $('scAdminFee').value=fmt.fmtInput(sc.adminFee||0);
  $('scFeeTreatment').value=['upfront','capitalise','discount'].includes(sc.feeTreatment)?sc.feeTreatment:'upfront';
  $('scLoanType').value=LOAN_TYPES.includes(sc.loanType)?sc.loanType:'annuity';
  $('scKnownPayment').value=fmt.fmtInput(sc.knownPayment||0);
  $('scIoPeriods').value=(sc.ioPeriods===undefined||sc.ioPeriods===null)?sc.termPeriods:sc.ioPeriods;
  $('scResidualPct').value=sc.residualPct||0;
  editorDraft={
    rateMode:sc.rateMode==='schedule'?'schedule':'simple',
    paymentMode:sc.paymentMode==='schedule'?'schedule':'single',
    ratePeriods:(Array.isArray(sc.ratePeriods)&&sc.ratePeriods.length)?sc.ratePeriods.map(x=>Object.assign({},x)):null,
    paymentPeriods:(Array.isArray(sc.paymentPeriods)&&sc.paymentPeriods.length)?sc.paymentPeriods.map(x=>Object.assign({},x)):null,
  };
  if(!editorDraft.ratePeriods)editorDraft.ratePeriods=defaultRatePeriods(editorTerm(),sc.financeRate,schedStart('rate'));
  if(!editorDraft.paymentPeriods)editorDraft.paymentPeriods=defaultPaymentPeriods(editorTerm(),(sc.knownPayment>0?sc.knownPayment:suggestedPayment()));
  syncSegGroups();
  renderSchedRows('rate');renderSchedRows('payment');
  updateEditorVisibility();updateImpliedRate();
  $('scenarioEditor').style.display='block';
  renderScenarioList();
}

function saveEditor(){
  if(editingIdx<0||!editorDraft)return;
  readSchedFromDOM('rate');readSchedFromDOM('payment');
  // The Term field is kept in the current frequency's units live (see the
  // scFreq change handler), so the draft already carries the right unit.
  const d=editorScenarioDraft();
  d.name=$('scName').value||'Scenario '+(editingIdx+1);
  if(d.freq!==scenarios[editingIdx].freq)updateTermLabel(d.freq);
  scenarios[editingIdx]=d;
  renderScenarioList();rerender();
}

function closeEditor(){editingIdx=-1;editorDraft=null;$('scenarioEditor').style.display='none';renderScenarioList();}

/* ─── Events ─── */
$('addScenarioBtn').addEventListener('click',()=>{scenarios.push(defaultScenario());openEditor(scenarios.length-1);rerender();});
$('scColor').addEventListener('input',e=>applyScenarioColor(editingIdx,e.target.value,true));
$('scColor').addEventListener('change',e=>applyScenarioColor(editingIdx,e.target.value,false));
$('saveScenarioBtn').addEventListener('click',()=>{saveEditor();closeEditor();});
$('cancelScenarioBtn').addEventListener('click',closeEditor);

// Base RF rate slider
['input','change'].forEach(evt=>{$('baseRf').addEventListener(evt,()=>{$('baseRfVal').textContent=fmt.pct(parseFloat($('baseRf').value)/100);rerender();});});

// Finance rate slider in editor — live update display
['input','change'].forEach(evt=>{$('scRate').addEventListener(evt,()=>{$('scRateVal').textContent=fmt.pct(parseFloat($('scRate').value)/100);});});
['input','change'].forEach(evt=>{$('scDownPct').addEventListener(evt,()=>{$('scDownVal').textContent=fmt.pct(parseFloat($('scDownPct').value||0)/100,0);});});

// Freq change: convert the Term field to the new unit so the loan DURATION is
// preserved (60 months → 260 weeks, not 60 weeks), then update the label.
$('scFreq').addEventListener('change',()=>{
  const newFreq=$('scFreq').value;
  if(newFreq!==editorTermFreq){
    const curTerm=parseFloat($('scTerm').value)||defaultTerm(editorTermFreq);
    const years=termToYears(curTerm, editorTermFreq);
    const scale=periodsPerYear(newFreq)/periodsPerYear(editorTermFreq);
    $('scTerm').value=Math.max(1,Math.round(years*periodsPerYear(newFreq)));
    // Schedule boundaries and the interest-only span are counted in repayments
    // too, so they scale with the unit exactly as the term does.
    const io=parseFloat($('scIoPeriods').value);
    if(isFinite(io))$('scIoPeriods').value=Math.max(0,Math.round(io*scale));
    editorTermFreq=newFreq;
    if(editorDraft){
      ['ratePeriods','paymentPeriods'].forEach(k=>{
        if(Array.isArray(editorDraft[k]))editorDraft[k]=editorDraft[k].map(x=>Object.assign({},x,{toPeriod:Math.max(1,Math.round((Number(x.toPeriod)||1)*scale))}));
      });
      renderSchedRows('rate');renderSchedRows('payment');
    }
  }
  updateTermLabel(newFreq);
  updateEditorVisibility();updateImpliedRate();
});

/* ─── Loan type, schedules, fee treatment, rate convention ─── */
$('scLoanType').addEventListener('change',()=>{
  if(!editorDraft)return;
  const t=editorLoanType();
  // Open each type on a workable number rather than a zero that cannot be
  // solved or a residual that makes the type a no-op.
  if(t==='knownPayment'&&!(parseNumInput($('scKnownPayment'))>0)){
    const sug=suggestedPayment();
    $('scKnownPayment').value=fmt.fmtInput(sug);
    editorDraft.paymentPeriods=defaultPaymentPeriods(editorTerm(),sug);
    renderSchedRows('payment');
  }
  if(usesIoPeriods(t)){
    const term=editorTerm(),cur=parseFloat($('scIoPeriods').value);
    // A holiday as long as the term leaves no instalment to defer TO — that is
    // a bullet, not a deferred start — so a value left behind by another type
    // opens on a fifth of the term. Interest-only is the opposite: the whole
    // term is its ordinary shape, so only a zero is replaced there.
    const workable=t==='deferred'?(cur>0&&cur<term):(cur>0);
    if(!workable)$('scIoPeriods').value=t==='deferred'?Math.max(1,Math.round(term/5)):term;
  }
  if(t==='balloon'&&!(parseFloat($('scResidualPct').value)>0))$('scResidualPct').value=30;
  updateEditorVisibility();updateImpliedRate();
});

[['scRateModeGroup','rateMode','rate'],['scPaymentModeGroup','paymentMode','payment']].forEach(([gid,key,kind])=>{
  document.querySelectorAll('#'+gid+' .seg-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!editorDraft)return;
      const v=btn.dataset.val;
      if(v===editorDraft[key])return;
      editorDraft[key]=v;
      if(v==='schedule'&&!(Array.isArray(editorDraft[kind==='rate'?'ratePeriods':'paymentPeriods'])&&editorDraft[kind==='rate'?'ratePeriods':'paymentPeriods'].length)){
        if(kind==='rate')editorDraft.ratePeriods=defaultRatePeriods(editorTerm(),parseFloat($('scRate').value)||5,schedStart('rate'));
        else editorDraft.paymentPeriods=defaultPaymentPeriods(editorTerm(),suggestedPayment());
      }
      syncSegGroups();renderSchedRows(kind);updateEditorVisibility();updateImpliedRate();
    });
  });
});

$('addRatePeriodBtn').addEventListener('click',()=>addSchedPeriod('rate'));
$('addPaymentPeriodBtn').addEventListener('click',()=>addSchedPeriod('payment'));

[['scRatePeriodRows','rate'],['scPaymentPeriodRows','payment']].forEach(([id,kind])=>{
  const wrap=$(id);
  wrap.addEventListener('click',e=>{
    const del=e.target.closest('.sp-delete');
    if(!del||del.disabled)return;
    const row=del.closest('.sched-row');
    readSchedFromDOM(kind);
    const list=schedList(kind);
    if(!list||list.length<=1)return;
    list.splice(parseInt(row.dataset.idx),1);
    renderSchedRows(kind);
    if(kind==='payment')updateImpliedRate();
  });
  wrap.addEventListener('change',e=>{
    if(e.target.classList.contains('sp-type')){
      // One row says its rate one way or the other, never both at once.
      const row=e.target.closest('.sched-row'),f=e.target.value==='floating';
      row.querySelector('.sp-fixed-wrap').style.display=f?'none':'';
      row.querySelector('.sp-float-wrap').style.display=f?'':'none';
    }
    readSchedFromDOM(kind);syncSchedLabels(kind);
    if(kind==='payment')updateImpliedRate();
  });
  wrap.addEventListener('input',()=>{
    readSchedFromDOM(kind);syncSchedLabels(kind);
    if(kind==='payment')updateImpliedRate();
  });
});

['scKnownPayment','scRate','scDownPct','scFeeAmt','scFeeType','scFeeTreatment'].forEach(id=>{
  ['input','change'].forEach(ev=>$(id).addEventListener(ev,updateImpliedRate));
});
['input','change'].forEach(ev=>$('scTerm').addEventListener(ev,()=>{
  syncSchedLabels('rate');syncSchedLabels('payment');updateImpliedRate();
}));
// A longer or shorter payment holiday moves the first instalment, and the rate
// schedule is counted from that instalment, so its ranges follow the field.
['input','change'].forEach(ev=>$('scIoPeriods').addEventListener(ev,()=>clampSchedToStart('rate')));
$('rateConvention').addEventListener('change',()=>{rerender();updateImpliedRate();});

['scName','scTerm','scFeeType'].forEach(id=>{['input','change'].forEach(evt=>{$(id).addEventListener(evt,()=>{/* live preview only on save click */});});});
['scFeeAmt'].forEach(id=>{$(id).addEventListener('blur',()=>{/* handled on save */});});
['chartMetric','optTarget'].forEach(id=>{$(id).addEventListener('change',rerender);});
$('currencySymbol').addEventListener('change',rerender);
$('inflationToggle').addEventListener('change',rerender);
$('inflationRate').addEventListener('change',rerender);

document.querySelectorAll('.ctrl-tab').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$('tab-'+btn.dataset.tab).classList.add('active');});});
$('mode2d').addEventListener('click',()=>{sensMode='2d';$('mode2d').classList.add('active');$('mode3d').classList.remove('active');$('sensYBlock').style.display='none';scheduleSensitivity();});
$('mode3d').addEventListener('click',()=>{sensMode='3d';$('mode3d').classList.add('active');$('mode2d').classList.remove('active');$('sensYBlock').style.display='';scheduleSensitivity();});
$('sensScenario').addEventListener('change',updateSensTermLabels);
$('sensVarX').addEventListener('change',()=>{const[a,b]=defaultAxisRange($('sensVarX').value,sensSelectedFreq(),sensSelectedScenario());$('sensXStart').value=a;$('sensXEnd').value=b;});
$('sensVarY').addEventListener('change',()=>{const[a,b]=defaultAxisRange($('sensVarY').value,sensSelectedFreq(),sensSelectedScenario());$('sensYStart').value=a;$('sensYEnd').value=b;});
// Every control in the Sensitivity panel redraws the sweep, the two above
// included: their own listeners re-seed the axis range first, and this one runs
// after them because it was added second.
['sensScenario','sensObjective','sensVarX','sensXStart','sensXEnd',
 'sensVarY','sensYStart','sensYEnd','sensSteps'].forEach(id=>{
  $(id).addEventListener('change',scheduleSensitivity);
  $(id).addEventListener('input',scheduleSensitivity);
});

$('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light');$('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';if(chartInstance){chartInstance.destroy();chartInstance=null;}if(sensChartInstance){sensChartInstance.destroy();sensChartInstance=null;}rerender();});
$('chartResetZoom').addEventListener('click',()=>{if(chartInstance)chartInstance.resetZoom();});
$('sensResetZoom').addEventListener('click',()=>{if(sensChartInstance)sensChartInstance.resetZoom();});
$('chartCanvas').addEventListener('mouseleave',()=>{$('hoverBox').textContent=HOVER_IDLE;});

/* ─── Quick Start ───────────────────────────────────────────────────────────
   Six worked comparisons, and the page's Reset. There is no Reset button any
   more because a scenario here already IS one: every preset is rebuilt from
   QS_DEFAULTS and defaultScenario() rather than from whatever is on screen, so
   a rate schedule, a balloon, a fee treatment or a currency left behind by the
   plan before it cannot survive the click. A separate Reset would only have
   been a worse version of the same thing — one more button that lands on the
   generic two-scenario opening state nobody was asking about.

   That claim is checked rather than trusted: _ref/quickstart-check.mjs applies
   each preset to a clean page and to a page whose every control has been
   scribbled over, and the two have to land on identical form state across every
   tab. _audit/accounting.mjs then holds each preset's own figures to the
   accounting identities in _audit/ACCOUNTING-PLAN.md.

   What the six are for. They are not six flavours of the same loan; each one
   exists because it is the shape of a decision people actually face, and each
   carries a lesson the arithmetic will prove:

     house      — the only comparison here where cash and finance are both
                  plausible for the same buyer. Fixed against a 2-year fixed
                  that reverts to variable, so the band on the chart is shut
                  for two years and opens after the revert. Inflation on: a
                  30-year answer means something different in today's money.
     car        — the balloon. A residual buys a smaller instalment and is paid
                  for in interest, and the residual itself falls due in one
                  lump with the final payment.
     phone      — a plan that quotes an instalment and no rate at all, which is
                  what Known repayment is for. Two of them, one genuinely 0%
                  and one not, because the only way to tell them apart is to
                  solve for the rate.
     card       — 0% with a conversion fee against 0% without. The fee is the
                  whole price of the plan and it is what decides the verdict.
     motorbike  — a flat rate, quoted per month, the way Indonesian
                  multifinance and Murabaha deals quote it. This is the one
                  preset on Nominal, because 0.9% a MONTH is a nominal quote
                  and compounding it would misstate the contract.
     deferred   — "nothing to pay for 12 months" against paying from day one.
                  It opens on the loan-balance chart because the lesson is a
                  picture: the debt climbing through the holiday.

   Interest-only and bullet are the two loan types no preset opens on; neither
   is a mass-market retail comparison, and run.mjs F9 and F15 pin them. */
var QS_DEFAULTS={currencySymbol:'$',purchaseCost:50000,availableCash:50000,riskFree:4.5,
  rateConvention:'ear',inflationOn:false,inflationRate:2.5,chartMetric:'wealth',optTarget:'netBenefit'};

/* Every preset holds MORE cash than the purchase price, and none of them holds
   exactly the price. Two reasons, one presentational and one arithmetic. Cash
   equal to the price leaves the cash buyer with nothing to invest, so the Cash
   Purchase Wealth tile reads $0, the Net Benefit column becomes a copy of the
   Ending Wealth column, and the page's own idea — that the money you do not
   spend is working — has nothing to show. And it costs nothing to avoid,
   because Net Benefit is a DIFFERENCE: the surplus is invested identically in
   both arms and cancels exactly, so the verdict a preset teaches is the same
   whatever buffer it carries. _audit/accounting.mjs pins that cancellation as
   identity C5, which is also what makes these buffers safe to choose freely. */
var QUICK_START_SCENARIOS={

  /* A $650,000 house against 20% down over 30 years. Both loans carry the same
     lender fees, so the only thing that differs between them is the rate
     structure — which is the whole point of putting them side by side. */
  /* $650,000 against 20% down, and three ways to carry it. All three share the
     same lender fees, so nothing here differs except the thing being compared.
     The 15-year column also puts a SHORTER horizon beside a 30-year one, which
     is the case the comparison table's per-row baseline exists for: the Cash
     Purchase tile runs to 30 years while that row is scored at its own 15. */
  house:{
    base:{purchaseCost:650000,availableCash:700000,riskFree:4.5,inflationOn:true,inflationRate:2.5},
    scenarios:[
      {name:'30yr fixed 6.10%',loanType:'annuity',financeRate:6.1,downPaymentPct:20,
       freq:'monthly',termPeriods:360,feeAmt:600,feeType:'fixed',feeTreatment:'upfront',adminFee:10},
      /* The revert is the product, not a footnote: two years at 5.80%, then a
         floating period simulated at 5.00, 6.75 and 8.50. */
      {name:'30yr: 2yr fixed, then variable',loanType:'annuity',financeRate:5.8,downPaymentPct:20,
       freq:'monthly',termPeriods:360,feeAmt:600,feeType:'fixed',feeTreatment:'upfront',adminFee:10,
       rateMode:'schedule',ratePeriods:[
         {toPeriod:24,type:'fixed',rate:5.8,rateMin:5.8,rateMax:5.8},
         {toPeriod:360,type:'floating',rate:6.75,rateMin:5,rateMax:8.5}]},
      /* Priced below the 30-year, as a shorter term really is. Double the
         instalment, a fraction of the interest, and a different horizon. */
      {name:'15yr fixed 5.85%',loanType:'annuity',financeRate:5.85,downPaymentPct:20,
       freq:'monthly',termPeriods:180,feeAmt:600,feeType:'fixed',feeTreatment:'upfront',adminFee:10}
    ]
  },

  /* $45,000 at one rate over two terms, plus the balloon. Three different
     instalments in DESCENDING order and three verdicts in ascending order,
     which is the whole lesson: the smallest monthly is the dearest deal. */
  car:{
    base:{purchaseCost:45000,availableCash:60000,riskFree:4.5},
    scenarios:[
      {name:'3yr loan, 10% down',loanType:'annuity',financeRate:8.4,downPaymentPct:10,
       freq:'monthly',termPeriods:36,feeAmt:400,feeType:'fixed',feeTreatment:'upfront'},
      {name:'5yr loan, 10% down',loanType:'annuity',financeRate:8.4,downPaymentPct:10,
       freq:'monthly',termPeriods:60,feeAmt:400,feeType:'fixed',feeTreatment:'upfront'},
      {name:'5yr with 35% balloon',loanType:'balloon',financeRate:8.4,downPaymentPct:10,
       freq:'monthly',termPeriods:60,feeAmt:400,feeType:'fixed',feeTreatment:'upfront',residualPct:35}
    ]
  },

  /* An $1,800 phone on three plans that quote an instalment and never a rate,
     over three different terms — because two plans over the SAME term need no
     tool at all: the cheaper instalment wins and everybody already knows it.
     Over different terms the ranking stops being readable off the price tag.
     12 x 150 is exactly 1,800, so it is genuinely 0% and beats holding cash;
     the other two are not, and the one with the SMALLEST instalment is the
     worst of the three. Only solving for the rate behind each says so. */
  phone:{
    base:{purchaseCost:1800,availableCash:4000,riskFree:4.5},
    scenarios:[
      {name:'12 x $150',loanType:'knownPayment',knownPayment:150,paymentMode:'single',
       freq:'monthly',termPeriods:12},
      {name:'24 x $82',loanType:'knownPayment',knownPayment:82,paymentMode:'single',
       freq:'monthly',termPeriods:24},
      {name:'36 x $57',loanType:'knownPayment',knownPayment:57,paymentMode:'single',
       freq:'monthly',termPeriods:36}
    ]
  },

  /* $3,000 converted at 0% over three different tenors. Not one rate among
     them, so the conversion fee is the entire cost — and because that fee is
     FIXED rather than per-period, the longest plan carries it best. Which puts
     the six-month plan, the middle one, last: it pays the same $90 as the
     twelve-month and has half the time to earn it back. A comparison whose
     answer is neither the shortest nor the largest instalment. */
  card:{
    base:{purchaseCost:3000,availableCash:8000,riskFree:4.5},
    scenarios:[
      {name:'3mo 0%, no fee',loanType:'annuity',financeRate:0,downPaymentPct:0,
       freq:'monthly',termPeriods:3},
      {name:'6mo 0%, 3% fee',loanType:'annuity',financeRate:0,downPaymentPct:0,
       freq:'monthly',termPeriods:6,feeAmt:3,feeType:'pct',feeTreatment:'upfront'},
      {name:'12mo 0%, 3% fee',loanType:'annuity',financeRate:0,downPaymentPct:0,
       freq:'monthly',termPeriods:12,feeAmt:3,feeType:'pct',feeTreatment:'upfront'}
    ]
  },

  /* Rp 35,000,000, 20% down, 36 months at 0.9% a month flat — 10.8% a year as
     the contract quotes it, which is why this preset is the one on Nominal:
     compound-converting a rate the lender states per month would charge 0.857%
     and misstate the deal. The risk-free rate is an Indonesian deposito.
     The comparison scenario is the same money on an ordinary declining-balance
     loan at the same headline 10.8%, which is what makes the gap legible. */
  motorbike:{
    base:{currencySymbol:'Rp',purchaseCost:35000000,availableCash:50000000,riskFree:5.5,
      rateConvention:'nominal'},
    scenarios:[
      {name:'36mo @ 0.9%/mo flat',loanType:'flat',financeRate:10.8,downPaymentPct:20,
       freq:'monthly',termPeriods:36,feeAmt:500000,feeType:'fixed',feeTreatment:'upfront'},
      {name:'36mo @ 10.8% amortizing',loanType:'annuity',financeRate:10.8,downPaymentPct:20,
       freq:'monthly',termPeriods:36,feeAmt:500000,feeType:'fixed',feeTreatment:'upfront'}
    ]
  },

  /* A $6,000 fit-out on a 12-month payment holiday at 19.90%, against the same
     rate and the same 36-month term paid from day one. Opens on the loan
     balance, because the lesson is the shape of that line. */
  deferred:{
    base:{purchaseCost:6000,availableCash:15000,riskFree:4.5,chartMetric:'loanBalance'},
    scenarios:[
      {name:'12mo holiday, then 24 payments',loanType:'deferred',financeRate:19.9,
       freq:'monthly',termPeriods:36,ioPeriods:12},
      {name:'36 payments from day one',loanType:'annuity',financeRate:19.9,
       freq:'monthly',termPeriods:36}
    ]
  }
};

/* Order matters twice here. The purchase cost is written before the scenarios,
   because normaliseScenario() reads it when it upgrades a pre-percentage down
   payment; and renderScenarioList() runs before rerender(), so the sensitivity
   dropdown is rebuilt against the list the reader can see. */
function applyQuickStart(key){
  const s=QUICK_START_SCENARIOS[key];
  if(!s)return;
  const b=Object.assign({},QS_DEFAULTS,s.base||{});

  $('currencySymbol').value=b.currencySymbol;
  currentCurrencySymbol=b.currencySymbol;
  $('purchaseCost').value=fmt.fmtInput(b.purchaseCost);
  $('availableCash').value=fmt.fmtInput(b.availableCash);
  $('baseRf').value=b.riskFree;
  $('baseRfVal').textContent=fmt.pct(b.riskFree/100);
  $('rateConvention').value=b.rateConvention;
  rateConvention=b.rateConvention;
  $('inflationToggle').checked=!!b.inflationOn;
  $('inflationRow').style.display=b.inflationOn?'':'none';
  $('inflationRate').value=b.inflationRate;
  $('chartMetric').value=b.chartMetric;
  $('optTarget').value=b.optTarget;

  /* Every scenario is built over defaultScenario() and then put through the
     same normaliser a hand-edited cache goes through, so a preset can only
     produce state the editor itself could have produced. The interest-only span
     follows the term rather than the 60 defaultScenario() hands out, so opening
     the editor on a 360-month loan and switching it to Interest-only does not
     land on somebody else's five years. */
  scenarios=s.scenarios.map(function(x){
    const seed=defaultScenario(x.name);
    seed.ioPeriods=Math.max(1,Math.round(x.termPeriods||seed.termPeriods));
    return normaliseScenario(Object.assign(seed,x));
  }).filter(Boolean);

  // The editor and the amortisation tab are views onto the plan before this one.
  editingIdx=-1;editorDraft=null;activeAmortIdx=0;
  $('scenarioEditor').style.display='none';

  /* The sensitivity panel is marked data-no-persist, but it is still on screen,
     so it is part of what a reset has to clear. Nulling the two range caches is
     the point: they exist to stop the axis range being re-seeded on every
     keystroke, and left alone they would hand this plan the last plan's sweep
     range whenever the two happen to share a loan shape. */
  sensMode='2d';
  $('mode2d').classList.add('active');$('mode3d').classList.remove('active');
  $('sensYBlock').style.display='none';
  $('sens2dSection').style.display='none';$('sens3dSection').style.display='none';
  $('sensScenario').value='0';
  $('sensObjective').value='netBenefit';
  $('sensVarX').value='financeRate';$('sensVarY').value='riskFreeRate';
  $('sensSteps').value=20;
  sensScKind=null;sensTermFreq=null;

  markQuickStart(key);
  renderScenarioList();rerender();
  if(persist)persist.schedule();
}

// The highlight is a claim about which preset is on screen. Passing no key
// clears it.
function markQuickStart(key){
  document.querySelectorAll('.quick-start-btn').forEach(function(b){
    b.classList.toggle('active',!!key&&b.dataset.preset===key);
  });
}

document.querySelectorAll('.quick-start-btn').forEach(function(btn){
  btn.addEventListener('click',function(){applyQuickStart(btn.dataset.preset);});
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

$('downloadBtn').addEventListener('click',()=>{
  const table=$('amortTableWrap').querySelector('table');
  if(!table)return;
  const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const rows=[...table.querySelectorAll('tr')].map(tr=>
    [...tr.querySelectorAll('th,td')].map(cell=>esc(cell.textContent.trim())).join(',')
  );
  if(!rows.length)return;
  const csv=cleanCSV('# Made using tool.adjiebrotots.com/financingvscash\n'+rows.join('\n'));
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='amortization_schedule.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ─── DOWNLOAD CHART PNG ─── */
function downloadChartJsPng(canvasId, filename, chartTitle, legendId, shouldDownload = true) {
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

  // Every visible entry with the mark it draws, so the export carries the
  // same key the page shows.
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
    const wmText = 'Made using tool.adjiebrotots.com/financingvscash';
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

function downloadChartJsSvg(canvasId, filename, chartTitle, legendId) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  // Every visible entry with the mark it draws, so the export carries the
  // same key the page shows.
  const legendItems = legendId ? SharedLegend.itemsOf(legendId) : [];
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
  img.setAttributeNS(xl,'href',src.toDataURL('image/png'));
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
$('chartPngBtn').addEventListener('click', () => {
  const title = document.getElementById('chartTitle')?.textContent || 'Finance vs Cash Purchase';
  downloadChartJsPng('chartCanvas', 'financing_wealth_chart.png', title, 'chartLegend');
});
$('sens2dPngBtn').addEventListener('click', () => {
  const title = document.getElementById('sens2dTitle')?.textContent || 'Finance vs Cash — 2D Sensitivity';
  downloadChartJsPng('sensCanvas', 'financing_sensitivity_2d.png', title, 'sensLegend');
});
async function withSens3dPngAnnotations(callback) {
  await ensurePlotly();
  const title3d = document.getElementById('sens3dTitle')?.textContent || 'Finance vs Cash — 3D Sensitivity Surface';
  const titleAnnotation = {
    xref:'paper', yref:'paper', x:0.5, y:1.06, xanchor:'center', yanchor:'bottom',
    showarrow:false, text:`<b>${title3d}</b>`,
    font:{ size:14, color:document.body.classList.contains('light')?'#2D3436':'#EAF1FF', family:'DM Sans, sans-serif' },
  };
  const wmAnnotation = {
    xref:'paper', yref:'paper', x:1, y:0, xanchor:'right', yanchor:'bottom',
    showarrow:false, text:'Made using tool.adjiebrotots.com/financingvscash',
    font:{ size:10, color:'rgba(60,60,60,0.22)', family:'DM Sans, sans-serif' },
  };
  await Plotly.relayout('plotly3d', { annotations:[titleAnnotation, wmAnnotation], images:[wmPlotlyImage()] });
  try { return await callback(); }
  finally { await Plotly.relayout('plotly3d', { annotations:[], images:[] }); }
}
$('sens3dPngBtn').addEventListener('click', async () => {
  await withSens3dPngAnnotations(() => Plotly.downloadImage('plotly3d', { format:'png', filename:'financing_sensitivity_3d', scale:3 }));
});
async function copyPlotlyPngToClipboard(plotId, options) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const dataUrl = await Plotly.toImage(plotId, options);
  const blob = await (await fetch(dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
$('chartCopyPngBtn').addEventListener('click', async () => {
  const title = document.getElementById('chartTitle')?.textContent || 'Finance vs Cash Purchase';
  try { await copyCanvasPngToClipboard(downloadChartJsPng('chartCanvas', 'financing_wealth_chart.png', title, 'chartLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('sens2dCopyPngBtn').addEventListener('click', async () => {
  const title = document.getElementById('sens2dTitle')?.textContent || 'Finance vs Cash — 2D Sensitivity';
  try { await copyCanvasPngToClipboard(downloadChartJsPng('sensCanvas', 'financing_sensitivity_2d.png', title, 'sensLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('sens3dCopyPngBtn').addEventListener('click', async () => {
  try { await withSens3dPngAnnotations(() => copyPlotlyPngToClipboard('plotly3d', { format:'png', scale:3 })); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('chartSvgBtn').addEventListener('click', () => {
  const title = document.getElementById('chartTitle')?.textContent || 'Finance vs Cash Purchase';
  downloadChartJsSvg('chartCanvas', 'financing_wealth_chart.svg', title, 'chartLegend');
});
$('sens2dSvgBtn').addEventListener('click', () => {
  const title = document.getElementById('sens2dTitle')?.textContent || 'Finance vs Cash — 2D Sensitivity';
  downloadChartJsSvg('sensCanvas', 'financing_sensitivity_2d.svg', title, 'sensLegend');
});
$('sens3dSvgBtn').addEventListener('click', async () => {
  await ensurePlotly();
  const title3d = document.getElementById('sens3dTitle')?.textContent || 'Finance vs Cash — 3D Sensitivity Surface';
  const titleAnnotation = {
    xref:'paper', yref:'paper', x:0.5, y:1.06, xanchor:'center', yanchor:'bottom',
    showarrow:false, text:`<b>${title3d}</b>`,
    font:{ size:14, color:document.body.classList.contains('light')?'#2D3436':'#EAF1FF', family:'DM Sans, sans-serif' },
  };
  const wmAnnotation = {
    xref:'paper', yref:'paper', x:1, y:0, xanchor:'right', yanchor:'bottom',
    showarrow:false, text:'Made using tool.adjiebrotots.com/financingvscash',
    font:{ size:10, color:'rgba(60,60,60,0.22)', family:'DM Sans, sans-serif' },
  };
  await Plotly.relayout('plotly3d', { annotations:[titleAnnotation, wmAnnotation], images:[wmPlotlyImage()] });
  await Plotly.downloadImage('plotly3d', { format:'svg', filename:'financing_sensitivity_3d' });
  await Plotly.relayout('plotly3d', { annotations:[], images:[] });
});

/* The 3D surface has no zoom to reset, but it does have a camera the reader
   can drag out of shape, so its ⟳ does the same job the Chart.js ones do:
   put the view back where the chart opened. The eye is the one the layout
   above sets. */
$('sens3dResetView').addEventListener('click', async () => {
  if(!window.Plotly) return;
  const el = $('plotly3d');
  if(!el || !el.data) return;
  await Plotly.relayout('plotly3d', {'scene.camera': {eye:{x:1.8, y:1.8, z:1.2}}});
});

/* ─── Slider Editable ─── */
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
      rangeEl.dispatchEvent(new Event('change',{bubbles:true}));
    }
    inp.style.display='none';valSpan.style.display='';
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}else if(e.key==='Escape'){inp.value='';commit();}});
}
[['baseRf','baseRfVal'],['scRate','scRateVal'],['scDownPct','scDownVal']
].forEach(([rid,vid])=>makeSliderEditable($(vid),$(rid)));

/* ─── Init ─── */
scenarios.push(defaultScenario('60mo Monthly @ 5%',5));
scenarios.push({...defaultScenario('36mo Monthly @ 7%',7),termPeriods:36,financeRate:7});
setupFmtInputs();renderScenarioList();rerender();

/* ─── Mini cache ───────────────────────────────────────────────────────────
   Persist the base inputs (form controls) plus the scenarios (JS array) so a
   returning user keeps their previous comparison. The scenario editor and the
   sensitivity panel are marked data-no-persist — they are transient. */
persist = Persist.init('financingvscash', {
  onRestore: function(){
    $('baseRfVal').textContent = fmt.pct(parseFloat($('baseRf').value)/100);
    renderScenarioList();
    updateSensScenarioDropdown();
    rerender();
  },
  extra: {
    save: function(){ return { scenarios: scenarios }; },
    // An empty list is a real state (the user deleted every scenario), so it
    // must survive a reload instead of falling back to the defaults.
    restore: function(e){ if(e && Array.isArray(e.scenarios)) scenarios = e.scenarios.map(normaliseScenario).filter(Boolean); }
  }
});
})();
