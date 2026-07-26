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
function cssVar(n){return getComputedStyle(document.body).getPropertyValue(n).trim();}
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

// Cached scenarios come back from localStorage and can be stale or hand-edited,
// so hold them to what the editor itself can produce. A loan with no repayment
// periods can never be repaid, so it is dropped rather than modelled.
function normaliseScenario(sc){
  if(!sc||typeof sc!=='object')return null;
  const num=(v,d)=>{const n=parseFloat(v);return isFinite(n)?n:d;};
  const freq=['weekly','fortnightly','monthly','yearly'].includes(sc.freq)?sc.freq:'monthly';
  const term=Math.round(num(sc.termPeriods,0));
  if(!(term>=1))return null;
  let downPct=sc.downPaymentPct;
  if(downPct===undefined&&sc.downPayment!==undefined)downPct=(num(sc.downPayment,0)/(parseNumInput($('purchaseCost'))||1))*100;
  return{name:String(sc.name||'Scenario'),financeRate:num(sc.financeRate,5),
    downPaymentPct:Math.min(100,Math.max(0,num(downPct,0))),termPeriods:term,freq,
    feeAmt:Math.max(0,num(sc.feeAmt,0)),feeType:sc.feeType==='pct'?'pct':'fixed',
    adminFee:Math.max(0,num(sc.adminFee,0))};
}

function defaultScenario(name,rate){
  const freq='monthly';
  return{name:name||'Scenario '+(scenarios.length+1),financeRate:rate||5,downPaymentPct:0,termPeriods:defaultTerm(freq),freq,feeAmt:0,feeType:'fixed',adminFee:0};
}

/*
 ══════════════════════════════════════════════════════════
 FINANCIAL ENGINE — VERIFIED MATHEMATICS
 ══════════════════════════════════════════════════════════

 1. PERIOD RATE (compound conversion — NOT simple r/n):
    r_period = (1 + r_annual)^(1/ppy) − 1

 2. AMORTIZATION PAYMENT (standard annuity formula):
    If r > 0:  PMT = P × r(1+r)^n / ((1+r)^n − 1)
    If r = 0:  PMT = P / n
    where P=principal, r=period rate, n=total periods

 3. EACH PERIOD:
    interest_i  = balance_i × r_period
    principal_i = PMT − interest_i
    balance_{i+1} = balance_i − principal_i

 4. INVESTMENT GROWTH (financing path):
    Start with: availableCash − downPayment − originationFee
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
 ══════════════════════════════════════════════════════════
*/

function computeAmortization(principal, annualRate, termPeriods, freq){
  const ppy=periodsPerYear(freq);
  const n=Math.round(termPeriods);
  const r=Math.pow(1+annualRate/100, 1/ppy)-1; // compound period rate

  if(principal<=0||n<=0) return{payment:0,schedule:[],totalInterest:0,totalPaid:0,periods:0,periodRate:0};

  let pmt;
  if(r===0) pmt=principal/n;
  else{
    const factor=Math.pow(1+r,n);
    pmt=principal*(r*factor)/(factor-1); // standard annuity formula
  }

  let bal=principal, totalInt=0;
  const schedule=[];
  for(let i=1;i<=n;i++){
    const intPart=bal*r;
    let prinPart=pmt-intPart;
    // Final payment: clear exact remaining balance
    if(i===n){prinPart=bal; const finalPmt=intPart+bal; schedule.push({num:i,startBal:bal,interest:intPart,principal:prinPart,payment:finalPmt,endBal:0}); totalInt+=intPart; bal=0;}
    else{if(prinPart>bal)prinPart=bal; const endBal=Math.max(0,bal-prinPart); schedule.push({num:i,startBal:bal,interest:intPart,principal:prinPart,payment:pmt,endBal}); totalInt+=intPart; bal=endBal;}
  }
  const totalPaid=schedule.reduce((s,p)=>s+p.payment,0);
  return{payment:pmt,schedule,totalInterest:totalInt,totalPaid,periods:n,periodRate:r};
}

function computeScenario(sc, purchaseCost, availableCash, riskFreeRate, inflationRate, inflationEnabled){
  const downPct=Math.min(100,Math.max(0,sc.downPaymentPct||0));
  const requestedDown=purchaseCost*(downPct/100);
  const down=Math.min(requestedDown,purchaseCost,availableCash);
  const financed=purchaseCost-down;
  const termYears=termToYears(sc.termPeriods,sc.freq);
  if(financed<=0) return computeScenarioAsCash(purchaseCost,availableCash,sc,riskFreeRate,inflationRate,inflationEnabled);

  const ppy=periodsPerYear(sc.freq);
  const n=Math.round(sc.termPeriods);
  let fee=sc.feeType==='pct'?financed*(sc.feeAmt/100):Math.max(0,sc.feeAmt);
  const adminFee=Math.max(0,sc.adminFee||0); // fixed amount paid every repayment
  const cashAfterUpfront=availableCash-down-fee;
  if(cashAfterUpfront<0) return null;

  const amort=computeAmortization(financed,sc.financeRate,sc.termPeriods,sc.freq);
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
  const totalFee=fee+totalAdminFee; // all fees: upfront origination + recurring admin
  const totalFinanceCost=amort.totalInterest+totalFee;
  const totalOOP=down+fee+amort.totalPaid+totalAdminFee;
  let inflAdj=null;
  if(inflationEnabled&&inflationRate>0){
    const rd=Math.pow(1+inflationRate/100,termYears);
    inflAdj={endWealthReal:endWealth/rd,totalFinanceCostReal:totalFinanceCost/rd};
  }
  return{down,financed,fee,adminFee,totalAdminFee,amort,endWealth,totalInterest:amort.totalInterest,totalFee,totalFinanceCost,payment:amort.payment,totalOOP,timeline,negCarry:riskFreeRate<sc.financeRate,inflAdj,cashAfter:cashAfterUpfront,n,ppy,termYears,termPeriods:sc.termPeriods,riskFreeRate,financeRate:sc.financeRate,freq:sc.freq};
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
  return{down:purchaseCost,financed:0,fee:0,adminFee:0,totalAdminFee:0,amort:{payment:0,schedule:[],totalInterest:0,totalPaid:0,periods:0,periodRate:0},endWealth:bal,totalInterest:0,totalFee:0,totalFinanceCost:0,payment:0,totalOOP:purchaseCost,timeline,negCarry:false,inflAdj,cashAfter:leftover,n,ppy,termYears,termPeriods:sc.termPeriods,riskFreeRate,financeRate:sc.financeRate,freq:sc.freq};
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

  const results=[];let anyNegCarry=false;const dropped=[];
  scenarios.forEach((sc,i)=>{
    const res=computeScenario(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled);
    if(res){res.name=sc.name;res.idx=i;res.colorVar=SCENARIO_COLORS[i%SCENARIO_COLORS.length];if(res.negCarry)anyNegCarry=true;}
    else dropped.push(sc.name);
    results.push(res);
  });
  $('negCarryBanner').style.display=anyNegCarry?'block':'none';
  $('negCarryBanner').textContent=anyNegCarry?'⚠ Negative carry: finance rate exceeds risk-free rate. Financing will likely cost more than investing.':'';
  // A scenario whose down payment + upfront fee exceeds available cash can't be
  // modelled; surface it instead of silently dropping it from the comparison.
  if(dropped.length){
    $('warnBanner').style.display='block';
    $('warnBanner').textContent='⚠ '+dropped.join(', ')+(dropped.length>1?' were':' was')+
      ' skipped: the down payment plus upfront fee exceeds your available cash. Lower the down payment or fee, or increase available cash.';
  }

  results.forEach(r=>{if(!r)return;const cb=computeCashBaseline(purchaseCost,availableCash,r.termYears,riskFreeRate,inflationRate,inflationEnabled);r.cashBaseWealth=cb.endWealth;r.netBenefit=r.endWealth-cb.endWealth;if(r.inflAdj&&cb.inflAdj)r.inflAdj.netBenefitReal=(r.inflAdj.endWealthReal||0)-(cb.inflAdj.endWealthReal||0);});

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
  else{$('kpiBest').textContent=bestResult.name;$('kpiBest').style.color=cssVar(bestResult.colorVar);$('kpiBestSub').textContent='Based on '+$('optTarget').selectedOptions[0].text.toLowerCase()+'.';}
  if(bestResult){const nb=snapNB(bestResult.netBenefit),cashWins=allNeg&&!tie;$('kpiNetBenefit').textContent=fmt.currency(nb,true);$('kpiNetBenefit').style.color=nb>0?cssVar('--positive-em'):nb<0?cssVar('--negative-em'):cssVar('--text');$('kpiNetSub').textContent=nb>0?'Financing is more wealth-efficient':nb<0?'Cash purchase preserves more wealth':'Financing and paying cash end up level';
    // The "(Best)" tiles must describe the strategy the verdict names: when the
    // cash purchase wins there is no loan, so there is no interest.
    $('kpiInterest').textContent=fmt.currency(cashWins?0:bestResult.totalInterest,true);$('kpiInterest').style.color=cssVar('--text');$('kpiIntSub').textContent=cashWins?'Paying cash pays no interest.':fmt.currencyExact(bestResult.payment)+'/'+freqLabel(bestResult.freq);}
  else{$('kpiNetBenefit').textContent='—';$('kpiNetBenefit').style.color=cssVar('--text');$('kpiNetSub').textContent='';$('kpiInterest').textContent='—';$('kpiInterest').style.color=cssVar('--text');$('kpiIntSub').textContent='';}
  $('kpiCashWealth').textContent=fmt.currency(cashBase.endWealth,true);$('kpiCashWealth').style.color=cssVar('--text');$('kpiCashSub').textContent=maxTerm>0?`After ${maxTerm.toFixed(1)} yr at ${fmt.pct(riskFreeRate/100)} risk-free`:'Cash left after buying outright.';

  renderMainChart(results);renderComparisonTable(results);renderAmortTabs(results);updateSensScenarioDropdown();
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

  const datasets=[],legendItems=[];
  if(metric==='wealth'){
    const cd=xs.map(yr=>({x:yr,y:left*Math.pow(1+rfAnnual,yr)}));
    datasets.push({label:'Cash Purchase',data:cd,borderColor:cssVar('--muted'),backgroundColor:'transparent',borderWidth:2,borderDash:[6,4],pointRadius:0,pointHoverRadius:4,tension:.3,fill:false});
    legendItems.push({label:'Cash Purchase',color:cssVar('--muted'),dash:true});
  }
  results.forEach(r=>{if(!r)return;const color=cssVar(r.colorVar);
    const rfP_r=Math.pow(1+rfAnnual,1/r.ppy)-1;
    const data=xs.map(yr=>({x:yr,y:periodValue(r, yr*r.ppy, rfP_r)}));
    datasets.push({label:r.name,data,borderColor:color,backgroundColor:color+'22',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:.3,fill:false});legendItems.push({label:r.name,color});
  });
  const le=$('chartLegend');le.innerHTML='';legendItems.forEach(l=>{const d=document.createElement('div');d.className='legend-item';d.innerHTML=`<span class="dot" style="background:${l.color};${l.dash?'border:2px dashed '+l.color+';background:transparent;':''}"></span><span>${l.label}</span>`;le.appendChild(d);});
  const yAxisLabel={wealth:`Wealth (${moneySymbol()})`,netBenefit:`Net Benefit (${moneySymbol()})`,investmentValue:`Investment Value (${moneySymbol()})`,loanBalance:`Loan Balance (${moneySymbol()})`}[metric]||`Value (${moneySymbol()})`;
  const xLabelOf=v=>{const n=+v;return Number.isInteger(n)?`Year ${n}`:`Year ${n.toFixed(2)}`;};
  const gc=cssVar('--chart-grid'),mc=cssVar('--chart-text'),tc=cssVar('--text');
  const tipLight=document.body.classList.contains('light');
  const tipBg=tipLight?'#FFFFFF':'#1e1e2e',tipTitle=tipLight?'#2D3436':'#EAF1FF',tipBody=tipLight?'#4A5A6A':'#A8B6CF',tipBorder=tipLight?'#D4DEEF':gc;
  const cfg={type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>xLabelOf(c[0].parsed.x),label:c=>`  ${c.dataset.label}: ${fmt.currency(c.parsed.y,true)}`},backgroundColor:tipBg,titleColor:tipTitle,bodyColor:tipBody,borderColor:tipBorder,borderWidth:1,padding:10,onAfterBody:items=>{if(!items.length)return;$('hoverBox').textContent=`${xLabelOf(items[0].parsed.x)}  —  `+items.map(i=>`${i.dataset.label}: ${fmt.currency(i.parsed.y,true)}`).join('  |  ');}},zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},scales:{x:{type:'linear',title:{display:true,text:'Years',color:mc,font:{size:12}},ticks:{color:mc,maxTicksLimit:12,font:{size:11}},grid:{color:gc}},y:{title:{display:true,text:yAxisLabel,color:mc,font:{size:12}},ticks:{color:mc,font:{size:11},callback:v=>fmt.currency(v,true)},grid:{color:gc}}}}};
  if(chartInstance){chartInstance.data=cfg.data;chartInstance.options.scales.x.ticks.color=mc;chartInstance.options.scales.x.grid.color=gc;chartInstance.options.scales.x.title.color=mc;chartInstance.options.scales.y.ticks.color=mc;chartInstance.options.scales.y.grid.color=gc;chartInstance.options.scales.y.title.color=mc;chartInstance.options.scales.y.title.text=yAxisLabel;chartInstance.update('none');}
  else chartInstance=new Chart($('chartCanvas'),cfg);
}

// Horizons are compared in years, but a sub-year term reads better in months.
function horizonTxt(y){const n=Number(y)||0;return n>0&&n<1?(n*12).toFixed(1)+' mo':n.toFixed(1)+' yr';}

function renderComparisonTable(results){
  const valid=results.filter(r=>r);if(!valid.length){$('compTableWrap').innerHTML='<p class="muted">Add financing scenarios to compare.</p>';return;}
  const inflOn=latestResults.inflationEnabled,pc=latestResults.purchaseCost;
  let h='<table><thead><tr><th>Metric</th><th>Cash Purchase</th>';valid.forEach(r=>{h+='<th>'+r.name+'</th>';});h+='</tr></thead><tbody>';
  const rows=[
    ['Down Payment (%)','—',r=>fmt.pct((r.down/latestResults.purchaseCost)||0,2)],
    ['Down Payment Amount','—',r=>fmt.currency(r.down)],['Financed Amount','—',r=>fmt.currency(r.financed)],
    ['Periodic Payment','—',r=>r.payment>0?fmt.currencyExact(r.payment)+'/'+freqLabel(r.freq):'—'],
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
  rows.forEach(([label,cashVal,fn])=>{
    h+=`<tr><td>${label}</td><td>${cashVal}</td>`;valid.forEach(r=>{h+='<td>'+fn(r)+'</td>';});h+='</tr>';
  });
  h+='</tbody></table>';$('compTableWrap').innerHTML=h;
}

function renderAmortTabs(results){
  const valid=results.filter(r=>r&&r.amort.schedule.length>0);const tb=$('amortTabs');tb.innerHTML='';
  if(!valid.length){$('amortTableWrap').innerHTML='<p class="muted">No financing scenarios with payments.</p>';return;}
  if(activeAmortIdx>=valid.length)activeAmortIdx=0;
  valid.forEach((r,i)=>{const b=document.createElement('button');b.className='tab-btn'+(i===activeAmortIdx?' active':'');b.textContent=r.name;b.addEventListener('click',()=>{activeAmortIdx=i;renderAmortTabs(results);});tb.appendChild(b);});
  const r=valid[activeAmortIdx];
  const periodHdr=freqLabel(r.freq).charAt(0).toUpperCase()+freqLabel(r.freq).slice(1)+' #';
  let h='<table><thead><tr><th>'+periodHdr+'</th><th>Start Balance</th><th>Interest</th><th>Principal</th><th>Payment</th><th>End Balance</th></tr></thead><tbody>';
  let tI=0,tP=0,tPmt=0;
  r.amort.schedule.forEach(p=>{tI+=p.interest;tP+=p.principal;tPmt+=p.payment;h+=`<tr><td>${fmt.num(p.num)}</td><td>${fmt.currencyExact(p.startBal)}</td><td>${fmt.currencyExact(p.interest)}</td><td>${fmt.currencyExact(p.principal)}</td><td>${fmt.currencyExact(p.payment)}</td><td>${fmt.currencyExact(p.endBal)}</td></tr>`;});
  h+=`<tr style="font-weight:800;border-top:2px solid var(--accent);"><td>Total</td><td></td><td>${fmt.currencyExact(tI)}</td><td>${fmt.currencyExact(tP)}</td><td>${fmt.currencyExact(tPmt)}</td><td></td></tr>`;
  if(r.fee>0)h+=`<tr><td colspan="6" style="text-align:left;color:var(--muted);">+ Origination Fee: ${fmt.currencyExact(r.fee)}</td></tr>`;
  if(r.totalAdminFee>0)h+=`<tr><td colspan="6" style="text-align:left;color:var(--muted);">+ Admin Fees: ${fmt.currencyExact(r.totalAdminFee)} (${fmt.num(r.amort.schedule.length)} × ${fmt.currencyExact(r.adminFee)}/${freqLabel(r.freq)})</td></tr>`;
  h+=`<tr><td colspan="6" style="text-align:left;color:var(--muted);">= Grand Total: ${fmt.currencyExact(tPmt+r.fee+r.totalAdminFee+r.down)} (incl. ${fmt.currencyExact(r.down)} down)</td></tr>`;
  h+='</tbody></table>';$('amortTableWrap').innerHTML=h;
}

function updateSensScenarioDropdown(){const s=$('sensScenario'),p=s.value;s.innerHTML='';scenarios.forEach((sc,i)=>{const o=document.createElement('option');o.value=i;o.textContent=sc.name;s.appendChild(o);});if(p&&parseInt(p)<scenarios.length)s.value=p;updateSensTermLabels();}

// The "Term" sweep variable is expressed in the selected scenario's repayment
// periods (weeks/months/years) rather than a fixed unit of years.
function sensSelectedFreq(){const sc=scenarios[parseInt($('sensScenario').value)];return sc?sc.freq:'monthly';}
let sensTermFreq=null; // last frequency the term sweep range was built for
function updateSensTermLabels(){
  const freq=sensSelectedFreq(),unit=termUnitLabel(freq);
  const xo=$('sensVarXTermOpt'),yo=$('sensVarYTermOpt');
  if(xo)xo.textContent='Term ('+unit+')';
  if(yo)yo.textContent='Term ('+unit+')';
  // A range of 12–84 means months for a monthly loan and years for a yearly
  // one, so re-seed it whenever the selected scenario's unit changes.
  if(freq!==sensTermFreq){
    sensTermFreq=freq;const[a,b]=defaultAxisRange('term',freq);
    if($('sensVarX').value==='term'){$('sensXStart').value=a;$('sensXEnd').value=b;}
    if($('sensVarY').value==='term'){$('sensYStart').value=a;$('sensYEnd').value=b;}
  }
}
function defaultAxisRange(vn,freq){
  if(vn==='term')return{weekly:[52,364],fortnightly:[26,182],monthly:[12,84],yearly:[1,10]}[freq]||[12,84];
  if(vn==='financeRate')return[1,10];
  if(vn==='riskFreeRate')return[1,8];
  if(vn==='downPayment')return[0,50];
  return[1,10];
}

/* ─── Sensitivity Engine ─── */
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
    if(vn==='financeRate')m.financeRate=val;
    else if(vn==='riskFreeRate'){/* now a global, override via closure */m._rfOverride=val;}
    else if(vn==='downPayment')m.downPaymentPct=Math.min(100,Math.max(0,val));
    else if(vn==='term')m.termPeriods=Math.max(1,Math.round(val));
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
    const labels=xVals.map(x=>x.toFixed(2));const color=cssVar(SCENARIO_COLORS[scIdx%SCENARIO_COLORS.length]);
    const gc=cssVar('--chart-grid'),mc=cssVar('--chart-text');
    const datasets=[{label:objL,data,borderColor:color,backgroundColor:color+'22',borderWidth:2.5,pointRadius:2,pointHoverRadius:5,tension:.3,fill:false},{label:'Zero',data:xVals.map(()=>0),borderColor:cssVar('--muted'),borderWidth:1,borderDash:[4,4],pointRadius:0,fill:false}];
    $('sensLegend').innerHTML=blocked?`<div class="legend-item" style="color:var(--muted)">${blocked}</div>`:`<div class="legend-item"><span class="dot" style="background:${color}"></span><span>${baseSc.name}</span></div>`;
    const cfg={type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>`${xL}: ${c[0].label}`,label:c=>Number.isFinite(c.parsed.y)?`${c.dataset.label}: ${fmt.currency(c.parsed.y,true)}`:`${c.dataset.label}: not feasible`}},zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},scales:{x:{title:{display:true,text:xL,color:mc},ticks:{color:mc,font:{size:11}},grid:{color:gc}},y:{title:{display:true,text:objL,color:mc},ticks:{color:mc,font:{size:11},callback:v=>fmt.currency(v,true)},grid:{color:gc}}}}};
    if(sensChartInstance){sensChartInstance.data=cfg.data;sensChartInstance.options=cfg.options;sensChartInstance.update('none');}
    else sensChartInstance=new Chart($('sensCanvas'),cfg);
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
    ensurePlotly()
      .then(()=>Plotly.newPlot('plotly3d',plotData,layout,{responsive:true,displayModeBar:true,displaylogo:false}))
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
function renderScenarioList(){
  const list=$('scenarioList');list.innerHTML='';
  scenarios.forEach((sc,i)=>{
    const div=document.createElement('div');div.className='scenario-card'+(editingIdx===i?' active':'');const color=cssVar(SCENARIO_COLORS[i%SCENARIO_COLORS.length]);
    div.innerHTML=`<div class="sc-header"><div class="sc-name"><span class="sc-dot" style="background:${color}"></span>${sc.name}</div><div class="sc-actions"><button class="sc-btn" data-action="edit" data-idx="${i}" title="Edit">✎</button><button class="sc-btn" data-action="dup" data-idx="${i}" title="Duplicate">⧉</button><button class="sc-btn del" data-action="del" data-idx="${i}" title="Delete">✕</button></div></div><div class="sc-summary">${fmt.pct(sc.financeRate/100)} rate · ${sc.termPeriods} ${termUnitLabel(sc.freq)} ${sc.freq} · ${fmt.pct((sc.downPaymentPct||0)/100,0)} down</div>`;
    div.querySelectorAll('.sc-btn').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();const a=btn.dataset.action,idx=parseInt(btn.dataset.idx);if(a==='edit')openEditor(idx);else if(a==='dup'){scenarios.push({...scenarios[idx],name:scenarios[idx].name+' (copy)'});renderScenarioList();rerender();}else if(a==='del'){scenarios.splice(idx,1);if(editingIdx===idx){editingIdx=-1;$('scenarioEditor').style.display='none';}renderScenarioList();rerender();}});});
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

function openEditor(idx){
  editingIdx=idx;const sc=scenarios[idx];
  if(sc.downPaymentPct===undefined&&sc.downPayment!==undefined){
    sc.downPaymentPct=Math.min(100,Math.max(0,(sc.downPayment/(parseNumInput($('purchaseCost'))||1))*100));
  }
  $('editorTitle').textContent='Edit: '+sc.name;
  $('scName').value=sc.name;
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
  $('scenarioEditor').style.display='block';
  renderScenarioList();
}

function saveEditor(){
  if(editingIdx<0)return;
  const sc=scenarios[editingIdx];
  sc.name=$('scName').value||'Scenario '+(editingIdx+1);
  const _r=parseFloat($('scRate').value);sc.financeRate=isNaN(_r)?5:_r;
  const downPct=parseFloat($('scDownPct').value);
  sc.downPaymentPct=isNaN(downPct)?0:Math.min(100,Math.max(0,downPct));
  const newFreq=$('scFreq').value;
  // The Term field is kept in the current frequency's units live (see the
  // scFreq change handler), so here we just persist it.
  if(newFreq!==sc.freq){sc.freq=newFreq;updateTermLabel(newFreq);}
  sc.termPeriods=Math.max(1,Math.round(parseFloat($('scTerm').value)||defaultTerm(sc.freq)));
  sc.feeAmt=Math.max(0,parseNumInput($('scFeeAmt')));
  sc.feeType=$('scFeeType').value;
  sc.adminFee=Math.max(0,parseNumInput($('scAdminFee')));
  renderScenarioList();rerender();
}

function closeEditor(){editingIdx=-1;$('scenarioEditor').style.display='none';renderScenarioList();}

/* ─── Events ─── */
$('addScenarioBtn').addEventListener('click',()=>{scenarios.push(defaultScenario());openEditor(scenarios.length-1);rerender();});
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
    $('scTerm').value=Math.max(1,Math.round(years*periodsPerYear(newFreq)));
    editorTermFreq=newFreq;
  }
  updateTermLabel(newFreq);
});

['scName','scTerm','scFeeType'].forEach(id=>{['input','change'].forEach(evt=>{$(id).addEventListener(evt,()=>{/* live preview only on save click */});});});
['scFeeAmt'].forEach(id=>{$(id).addEventListener('blur',()=>{/* handled on save */});});
['chartMetric','optTarget'].forEach(id=>{$(id).addEventListener('change',rerender);});
$('currencySymbol').addEventListener('change',rerender);
$('inflationToggle').addEventListener('change',rerender);
$('inflationRate').addEventListener('change',rerender);

document.querySelectorAll('.ctrl-tab').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$('tab-'+btn.dataset.tab).classList.add('active');});});
$('mode2d').addEventListener('click',()=>{sensMode='2d';$('mode2d').classList.add('active');$('mode3d').classList.remove('active');$('sensYBlock').style.display='none';});
$('mode3d').addEventListener('click',()=>{sensMode='3d';$('mode3d').classList.add('active');$('mode2d').classList.remove('active');$('sensYBlock').style.display='';});
$('runSensBtn').addEventListener('click',runSensitivity);
$('sensScenario').addEventListener('change',updateSensTermLabels);
$('sensVarX').addEventListener('change',()=>{const[a,b]=defaultAxisRange($('sensVarX').value,sensSelectedFreq());$('sensXStart').value=a;$('sensXEnd').value=b;});
$('sensVarY').addEventListener('change',()=>{const[a,b]=defaultAxisRange($('sensVarY').value,sensSelectedFreq());$('sensYStart').value=a;$('sensYEnd').value=b;});

$('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light');$('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';if(chartInstance){chartInstance.destroy();chartInstance=null;}if(sensChartInstance){sensChartInstance.destroy();sensChartInstance=null;}rerender();});
$('chartResetZoom').addEventListener('click',()=>{if(chartInstance)chartInstance.resetZoom();});
$('sensResetZoom').addEventListener('click',()=>{if(sensChartInstance)sensChartInstance.resetZoom();});
$('chartCanvas').addEventListener('mouseleave',()=>{$('hoverBox').textContent='Hover over the chart to inspect a period.';});

$('resetBtn').addEventListener('click',()=>{
  scenarios=[];
  scenarios.push(defaultScenario('60mo Monthly @ 5%',5));
  scenarios.push({...defaultScenario('36mo Monthly @ 7%',7),termPeriods:36,financeRate:7});
  editingIdx=-1;
  $('scenarioEditor').style.display='none';
  $('purchaseCost').value=fmt.fmtInput(50000);
  $('availableCash').value=fmt.fmtInput(50000);
  $('currencySymbol').value='$';
  $('baseRf').value=4.5;
  $('baseRfVal').textContent='4.50%';
  $('inflationToggle').checked=false;
  $('inflationRate').value=2.5;
  $('chartMetric').value='wealth';
  $('optTarget').value='netBenefit';
  $('sens2dSection').style.display='none';
  $('sens3dSection').style.display='none';
  renderScenarioList();rerender();
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
