(function(){
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
// Watermark wordmark ("Made using tool.adjiebrotots.com/pisahvsgabung") baked to DM Sans 500 glyph
// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.
const WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM180.1 2.42V-5.69H181.09L181.19 -4.83Q181.37 -5.1 181.63 -5.32Q181.89 -5.55 182.26 -5.68Q182.63 -5.82 183.11 -5.82Q183.9 -5.82 184.49 -5.43Q185.08 -5.04 185.41 -4.37Q185.74 -3.7 185.74 -2.83Q185.74 -1.98 185.4 -1.31Q185.07 -0.64 184.47 -0.25Q183.88 0.13 183.11 0.13Q182.45 0.13 181.96 -0.13Q181.47 -0.39 181.2 -0.85V2.42ZM182.92 -0.82Q183.41 -0.82 183.79 -1.07Q184.17 -1.32 184.4 -1.77Q184.62 -2.23 184.62 -2.84Q184.62 -3.46 184.4 -3.91Q184.17 -4.37 183.79 -4.61Q183.41 -4.86 182.92 -4.86Q182.4 -4.86 182.02 -4.61Q181.63 -4.37 181.42 -3.91Q181.21 -3.46 181.21 -2.84Q181.21 -2.23 181.42 -1.77Q181.63 -1.32 182.02 -1.07Q182.4 -0.82 182.92 -0.82ZM187.13 0V-5.69H188.23V0ZM187.69 -6.69Q187.37 -6.69 187.17 -6.89Q186.96 -7.09 186.96 -7.39Q186.96 -7.69 187.17 -7.88Q187.37 -8.07 187.69 -8.07Q187.99 -8.07 188.2 -7.88Q188.41 -7.69 188.41 -7.39Q188.41 -7.09 188.2 -6.89Q187.99 -6.69 187.69 -6.69ZM191.97 0.13Q191.21 0.13 190.68 -0.11Q190.16 -0.34 189.87 -0.77Q189.59 -1.19 189.53 -1.75H190.65Q190.69 -1.48 190.85 -1.26Q191 -1.03 191.28 -0.9Q191.56 -0.76 191.97 -0.76Q192.33 -0.76 192.57 -0.87Q192.81 -0.97 192.93 -1.16Q193.05 -1.34 193.05 -1.58Q193.05 -1.9 192.9 -2.07Q192.75 -2.25 192.46 -2.35Q192.17 -2.44 191.75 -2.5Q191.31 -2.58 190.93 -2.69Q190.56 -2.81 190.29 -3Q190.01 -3.19 189.87 -3.48Q189.72 -3.77 189.72 -4.17Q189.72 -4.65 189.98 -5.02Q190.23 -5.4 190.71 -5.61Q191.19 -5.82 191.84 -5.82Q192.8 -5.82 193.36 -5.38Q193.91 -4.95 194.01 -4.16H192.95Q192.89 -4.52 192.6 -4.72Q192.31 -4.92 191.83 -4.92Q191.33 -4.92 191.07 -4.74Q190.81 -4.55 190.81 -4.24Q190.81 -4.02 190.94 -3.85Q191.07 -3.68 191.35 -3.56Q191.64 -3.44 192.1 -3.37Q192.75 -3.27 193.21 -3.1Q193.67 -2.93 193.92 -2.59Q194.18 -2.26 194.17 -1.66Q194.17 -1.1 193.9 -0.7Q193.62 -0.3 193.13 -0.08Q192.64 0.13 191.97 0.13ZM197.33 0.13Q196.66 0.13 196.22 -0.11Q195.77 -0.35 195.55 -0.75Q195.34 -1.15 195.34 -1.62Q195.34 -2.17 195.62 -2.56Q195.9 -2.96 196.43 -3.17Q196.95 -3.38 197.69 -3.38H199.11Q199.11 -3.89 198.98 -4.23Q198.85 -4.57 198.58 -4.74Q198.3 -4.9 197.84 -4.9Q197.37 -4.9 197.03 -4.68Q196.7 -4.45 196.62 -4H195.52Q195.58 -4.58 195.9 -4.98Q196.23 -5.39 196.74 -5.6Q197.25 -5.82 197.85 -5.82Q198.63 -5.82 199.15 -5.54Q199.68 -5.27 199.94 -4.77Q200.21 -4.27 200.21 -3.58V0H199.25L199.16 -0.94Q199.05 -0.72 198.88 -0.52Q198.71 -0.33 198.48 -0.18Q198.25 -0.03 197.97 0.05Q197.68 0.13 197.33 0.13ZM197.54 -0.76Q197.88 -0.76 198.16 -0.91Q198.44 -1.05 198.65 -1.31Q198.85 -1.56 198.96 -1.87Q199.08 -2.19 199.09 -2.54V-2.6H197.79Q197.33 -2.6 197.04 -2.49Q196.75 -2.37 196.62 -2.16Q196.49 -1.95 196.49 -1.69Q196.49 -1.4 196.61 -1.2Q196.74 -0.99 196.97 -0.88Q197.21 -0.76 197.54 -0.76ZM201.69 0V-7.92H202.79V-4.79Q203.07 -5.27 203.56 -5.54Q204.04 -5.82 204.63 -5.82Q205.3 -5.82 205.77 -5.56Q206.24 -5.3 206.49 -4.78Q206.73 -4.26 206.73 -3.47V0H205.64V-3.35Q205.64 -4.11 205.3 -4.5Q204.96 -4.88 204.33 -4.88Q203.91 -4.88 203.56 -4.68Q203.21 -4.48 203 -4.09Q202.79 -3.7 202.79 -3.14V0ZM209.83 0 207.69 -5.69H208.85L210.48 -1.05L212.12 -5.69H213.26L211.12 0ZM216.4 0.13Q215.64 0.13 215.11 -0.11Q214.59 -0.34 214.3 -0.77Q214.02 -1.19 213.97 -1.75H215.08Q215.13 -1.48 215.28 -1.26Q215.43 -1.03 215.71 -0.9Q215.99 -0.76 216.41 -0.76Q216.76 -0.76 217 -0.87Q217.24 -0.97 217.36 -1.16Q217.48 -1.34 217.48 -1.58Q217.48 -1.9 217.33 -2.07Q217.18 -2.25 216.89 -2.35Q216.6 -2.44 216.18 -2.5Q215.74 -2.58 215.36 -2.69Q214.99 -2.81 214.72 -3Q214.45 -3.19 214.3 -3.48Q214.15 -3.77 214.15 -4.17Q214.15 -4.65 214.41 -5.02Q214.66 -5.4 215.14 -5.61Q215.62 -5.82 216.27 -5.82Q217.23 -5.82 217.79 -5.38Q218.35 -4.95 218.45 -4.16H217.38Q217.32 -4.52 217.03 -4.72Q216.74 -4.92 216.26 -4.92Q215.76 -4.92 215.5 -4.74Q215.24 -4.55 215.24 -4.24Q215.24 -4.02 215.37 -3.85Q215.5 -3.68 215.78 -3.56Q216.07 -3.44 216.53 -3.37Q217.18 -3.27 217.64 -3.1Q218.1 -2.93 218.36 -2.59Q218.61 -2.26 218.6 -1.66Q218.6 -1.1 218.33 -0.7Q218.06 -0.3 217.56 -0.08Q217.07 0.13 216.4 0.13ZM222.23 2.55Q221.44 2.55 220.85 2.36Q220.27 2.17 219.94 1.77Q219.62 1.38 219.62 0.8Q219.62 0.49 219.75 0.18Q219.89 -0.13 220.18 -0.41Q220.48 -0.68 220.98 -0.9L221.64 -0.41Q221.05 -0.19 220.85 0.1Q220.66 0.4 220.66 0.69Q220.66 1.02 220.86 1.24Q221.05 1.46 221.41 1.57Q221.76 1.68 222.22 1.68Q222.67 1.68 223 1.56Q223.32 1.45 223.5 1.23Q223.68 1.01 223.68 0.72Q223.68 0.32 223.41 0.08Q223.14 -0.15 222.36 -0.19Q221.73 -0.24 221.28 -0.32Q220.84 -0.4 220.53 -0.5Q220.23 -0.61 220.03 -0.75Q219.82 -0.88 219.67 -1.02V-1.28L220.79 -2.39L221.71 -2.09L220.47 -0.99L220.7 -1.5Q220.82 -1.42 220.93 -1.35Q221.05 -1.28 221.23 -1.22Q221.42 -1.16 221.75 -1.11Q222.08 -1.06 222.61 -1.02Q223.38 -0.96 223.84 -0.76Q224.31 -0.55 224.52 -0.19Q224.73 0.17 224.73 0.68Q224.73 1.16 224.47 1.58Q224.21 2.01 223.65 2.28Q223.1 2.55 222.23 2.55ZM222.22 -1.75Q221.52 -1.75 221.03 -2.01Q220.53 -2.28 220.28 -2.75Q220.02 -3.21 220.02 -3.78Q220.02 -4.36 220.28 -4.81Q220.54 -5.27 221.03 -5.55Q221.53 -5.82 222.22 -5.82Q222.93 -5.82 223.42 -5.55Q223.91 -5.27 224.16 -4.81Q224.42 -4.36 224.42 -3.78Q224.42 -3.21 224.16 -2.75Q223.91 -2.28 223.42 -2.01Q222.93 -1.75 222.22 -1.75ZM222.22 -2.62Q222.78 -2.62 223.09 -2.91Q223.41 -3.2 223.41 -3.78Q223.41 -4.35 223.09 -4.64Q222.78 -4.93 222.22 -4.93Q221.69 -4.93 221.35 -4.64Q221.02 -4.35 221.02 -3.78Q221.02 -3.2 221.34 -2.91Q221.67 -2.62 222.22 -2.62ZM223.17 -4.82 222.9 -5.69H225.17V-4.94ZM228.11 0.13Q227.44 0.13 227 -0.11Q226.55 -0.35 226.33 -0.75Q226.11 -1.15 226.11 -1.62Q226.11 -2.17 226.39 -2.56Q226.68 -2.96 227.2 -3.17Q227.73 -3.38 228.46 -3.38H229.88Q229.88 -3.89 229.76 -4.23Q229.63 -4.57 229.35 -4.74Q229.08 -4.9 228.62 -4.9Q228.15 -4.9 227.81 -4.68Q227.48 -4.45 227.39 -4H226.29Q226.36 -4.58 226.68 -4.98Q227.01 -5.39 227.52 -5.6Q228.03 -5.82 228.62 -5.82Q229.4 -5.82 229.93 -5.54Q230.46 -5.27 230.72 -4.77Q230.98 -4.27 230.98 -3.58V0H230.02L229.94 -0.94Q229.82 -0.72 229.65 -0.52Q229.48 -0.33 229.26 -0.18Q229.03 -0.03 228.74 0.05Q228.46 0.13 228.11 0.13ZM228.31 -0.76Q228.65 -0.76 228.94 -0.91Q229.22 -1.05 229.42 -1.31Q229.63 -1.56 229.74 -1.87Q229.86 -2.19 229.87 -2.54V-2.6H228.57Q228.11 -2.6 227.82 -2.49Q227.53 -2.37 227.4 -2.16Q227.27 -1.95 227.27 -1.69Q227.27 -1.4 227.39 -1.2Q227.51 -0.99 227.75 -0.88Q227.99 -0.76 228.31 -0.76ZM235.48 0.13Q234.99 0.13 234.62 -0.01Q234.25 -0.15 233.99 -0.37Q233.73 -0.6 233.56 -0.84L233.46 0H232.47V-7.92H233.57V-4.82Q233.84 -5.29 234.33 -5.55Q234.82 -5.82 235.46 -5.82Q236.25 -5.82 236.85 -5.44Q237.44 -5.05 237.78 -4.39Q238.11 -3.72 238.11 -2.86Q238.11 -2 237.78 -1.32Q237.45 -0.64 236.86 -0.26Q236.26 0.13 235.48 0.13ZM235.29 -0.82Q235.78 -0.82 236.16 -1.07Q236.54 -1.32 236.77 -1.77Q236.99 -2.23 236.99 -2.84Q236.99 -3.46 236.77 -3.91Q236.54 -4.37 236.16 -4.61Q235.78 -4.86 235.29 -4.86Q234.77 -4.86 234.39 -4.61Q234 -4.37 233.79 -3.91Q233.58 -3.46 233.58 -2.84Q233.58 -2.23 233.79 -1.77Q234 -1.32 234.39 -1.07Q234.77 -0.82 235.29 -0.82ZM241.51 0.13Q240.86 0.13 240.38 -0.12Q239.91 -0.37 239.65 -0.88Q239.39 -1.4 239.39 -2.16V-5.69H240.49V-2.29Q240.49 -1.54 240.83 -1.17Q241.18 -0.8 241.8 -0.8Q242.22 -0.8 242.56 -1Q242.89 -1.19 243.09 -1.56Q243.29 -1.94 243.29 -2.48V-5.69H244.39V0H243.41L243.33 -0.92Q243.1 -0.43 242.62 -0.15Q242.14 0.13 241.51 0.13ZM245.92 0V-5.69H246.91L246.97 -4.77Q247.22 -5.26 247.7 -5.54Q248.18 -5.82 248.81 -5.82Q249.47 -5.82 249.94 -5.56Q250.41 -5.31 250.67 -4.79Q250.93 -4.28 250.93 -3.51V0H249.83V-3.4Q249.83 -4.13 249.49 -4.51Q249.14 -4.88 248.52 -4.88Q248.1 -4.88 247.76 -4.69Q247.42 -4.49 247.22 -4.12Q247.02 -3.74 247.02 -3.2V0ZM254.71 2.55Q253.93 2.55 253.34 2.36Q252.75 2.17 252.43 1.77Q252.1 1.38 252.1 0.8Q252.1 0.49 252.24 0.18Q252.37 -0.13 252.67 -0.41Q252.96 -0.68 253.46 -0.9L254.12 -0.41Q253.53 -0.19 253.34 0.1Q253.14 0.4 253.14 0.69Q253.14 1.02 253.34 1.24Q253.54 1.46 253.89 1.57Q254.24 1.68 254.7 1.68Q255.15 1.68 255.48 1.56Q255.81 1.45 255.98 1.23Q256.16 1.01 256.16 0.72Q256.16 0.32 255.89 0.08Q255.63 -0.15 254.85 -0.19Q254.21 -0.24 253.76 -0.32Q253.32 -0.4 253.02 -0.5Q252.72 -0.61 252.51 -0.75Q252.31 -0.88 252.16 -1.02V-1.28L253.27 -2.39L254.19 -2.09L252.95 -0.99L253.18 -1.5Q253.3 -1.42 253.42 -1.35Q253.53 -1.28 253.72 -1.22Q253.91 -1.16 254.23 -1.11Q254.56 -1.06 255.1 -1.02Q255.86 -0.96 256.32 -0.76Q256.79 -0.55 257 -0.19Q257.21 0.17 257.21 0.68Q257.21 1.16 256.95 1.58Q256.69 2.01 256.14 2.28Q255.58 2.55 254.71 2.55ZM254.7 -1.75Q254 -1.75 253.51 -2.01Q253.02 -2.28 252.76 -2.75Q252.5 -3.21 252.5 -3.78Q252.5 -4.36 252.76 -4.81Q253.02 -5.27 253.52 -5.55Q254.01 -5.82 254.7 -5.82Q255.41 -5.82 255.9 -5.55Q256.39 -5.27 256.65 -4.81Q256.9 -4.36 256.9 -3.78Q256.9 -3.21 256.65 -2.75Q256.39 -2.28 255.9 -2.01Q255.41 -1.75 254.7 -1.75ZM254.7 -2.62Q255.26 -2.62 255.58 -2.91Q255.89 -3.2 255.89 -3.78Q255.89 -4.35 255.58 -4.64Q255.26 -4.93 254.7 -4.93Q254.17 -4.93 253.83 -4.64Q253.5 -4.35 253.5 -3.78Q253.5 -3.2 253.83 -2.91Q254.16 -2.62 254.7 -2.62ZM255.65 -4.82 255.38 -5.69H257.66V-4.94Z";
const WM_PATH_W = 258.0;
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

const $ = id => document.getElementById(id);

/* ── Translations ── */
const LANG = {
  en: {
    subtitle: 'Compare Indonesian personal income tax under separate filing (Pisah Harta) vs joint filing (Gabung Harta).',
    btnBack: '← Other Tools',
    tabInputs: '📊 Inputs',
    tabAdvanced: '📋 PTKP & Brackets',
    dependentsLabel: 'Number of Dependents (Tanggungan)',
    dep0: '0 — no dependents',
    dep1: '1 — one child (anak)',
    dep2: '2 — two children (anak)',
    dep3: '3 — three children (anak)',
    inputMethodLabel: 'Income Input Method',
    modeTotalBtn: 'Total + Split %',
    modeSplitBtn: 'Husband + Wife',
    totalSalaryLabel: 'Total Household Gross Salary',
    totalSalaryTip: 'Combined annual gross salary of husband + wife.',
    wifeShareLabel: "Wife's share of income",
    wifeShareTip: 'Percentage of total household salary earned by wife. Husband earns the remainder.',
    deductionLabel: 'Combined Annual Deductions (Pengurang)',
    deductionTip: "Biaya jabatan, iuran pensiun, or other allowable deductions. Applied to gross income before PTKP. Split proportionally by each spouse's income share.",
    husbandSalaryLabel: "Husband's Gross Salary",
    wifeSalaryLabel: "Wife's Gross Salary",
    combinedPrefix: 'Combined:',
    wifeSharePrefix: 'Wife share:',
    husbandDeductionLabel: "Husband's Annual Deductions (Pengurang)",
    husbandDeductionTip: "Applied only to husband's gross income before PTKP.",
    wifeDeductionLabel: "Wife's Annual Deductions (Pengurang)",
    wifeDeductionTip: "Applied only to wife's gross income before PTKP.",
    ptkpSectionLabel: 'PTKP Values (Rp)',
    ptkpTK0: 'TK/0 — Single (base)',
    ptkpK: 'K — Married addition',
    ptkpI: 'I — Working spouse addition',
    ptkpDep: 'Per dependent (tanggungan)',
    ptkpComputedPrefix: 'Computed PTKP → Pisah:',
    ptkpHLabel: '(H)',
    ptkpWLabel: '(W)',
    ptkpGLabel: 'Gabung:',
    bracketSectionLabel: 'Tax Brackets (PPh 21)',
    bracketFrom: 'From (Rp)',
    bracketToHtml: 'To (Rp) <span style="font-size:0.68rem">(blank=∞)</span>',
    bracketRate: 'Rate (%)',
    bracketTip: 'Edit thresholds and rates. "From" is auto-managed. Last bracket has no upper bound.',
    infoBoxHtml: '<strong>Pisah Harta (K/0 + TK/0):</strong> Each spouse files their own SPT. Husband uses PTKP K/tanggungan, wife uses PTKP TK/0. Double bracket access.<br><br><strong>Gabung Harta (K/I/0):</strong> Combined income, single SPT. Uses PTKP K/I/tanggungan. One bracket ladder for all income.',
    resetBtn: '↺ Reset',
    kpiPisahLabel: 'Pisah Harta — Total Tax',
    kpiGabungLabel: 'Gabung Harta — Total Tax',
    kpiSavingLabel: 'Tax Savings (Cheaper Option)',
    effectiveRate: 'Effective Rate:',
    noSignificantDiff: 'No significant difference',
    pisahWins: '✅ Pisah Harta wins',
    gabungWins: '✅ Gabung Harta wins',
    posTitle: '📍 Your Current Tax Position',
    posMaxMarginal: 'Max Marginal Bracket',
    posEffPisah: 'Effective Rate — Pisah',
    posEffGabung: 'Effective Rate — Gabung',
    margFrom: 'from',
    chart1Title: 'Total Tax by Household Salary',
    chart1Sub: 'Shows total tax payable across salary range. The gap between lines = tax savings.',
    chart1XTitle: 'Total Household Salary',
    chart1YTitle: 'Total Tax Payable',
    resetZoom: '⟳',
    hoverBox1: 'Hover over the chart to inspect a salary point.',
    chart2Title: 'Tax Difference (Gabung − Pisah)',
    chart2Sub: 'Positive = Gabung Harta pays more (Pisah Harta wins). Negative = Gabung Harta pays less (Gabung Harta wins).',
    chart2YTitle: 'Tax Difference (positive = Pisah wins)',
    hoverBox2: 'Hover over the chart to inspect the difference.',
    legendPisah: 'Pisah Harta (K/0 + TK/0)',
    legendGabung: 'Gabung Harta (K/I/0)',
    legendPisahWins: 'Pisah Harta wins (positive)',
    legendGabungWins: 'Gabung Harta wins (negative)',
    salaryLabel: 'Salary',
    pisahSavesPrefix: 'Pisah saves:',
    gabungSavesPrefix: 'Gabung saves:',
    summaryTitle: 'Summary at Current Salary',
    crossoverTitle: 'Crossover Analysis',
    tilePtkpHusband: 'PTKP Husband (Pisah)',
    tilePtkpWife: 'PTKP Wife (Pisah)',
    tileTotalPtkpPisah: 'Total PTKP Pisah',
    tileGrosssalary: 'Gross Salary',
    tileDeductions: 'Deductions (Pengurang)',
    tileNetIncome: 'Net Income (after deductions)',
    tileHusbandNet: 'Husband Net Income',
    tileWifeNet: 'Wife Net Income',
    crossoverWith: 'With',
    crossoverWifePct: '% wife income:',
    crossoverWastedHtml: 'The non-earning spouse\'s PTKP is entirely wasted under Pisah Harta. Gabung Harta consolidates all PTKP into one filing, making it <span class="negative">beneficial</span> at this split.',
    crossoverAdjust: 'Adjust the income split to see where Pisah Harta becomes advantageous due to double bracket access.',
    crossoverPoint: 'Crossover point:',
    crossoverBelowPre: 'Below this salary, <span class="negative">Gabung Harta (K/I/',
    crossoverBelowPost: ')</span> may pay less because the higher combined PTKP is utilized more efficiently relative to income.',
    crossoverAbovePre: 'Above this salary, <span class="positive">Pisah Harta (K/',
    crossoverAbovePost: '+ TK/0)</span> wins because each spouse accesses lower tax brackets independently.',
    crossoverNoneFound: 'No crossover found in range.',
    crossoverPisahBetterPre: 'At this income split (',
    crossoverPisahBetterPost: '%), <span class="positive">Pisah Harta</span> is better (or equal) across the entire salary range. Both schemes have the same total PTKP at even splits, but Pisah Harta benefits from dual bracket access.',
    crossoverGabungBetterHtml: 'At this income split, <span class="negative">Gabung Harta</span> appears advantageous across the range. This typically occurs when the income split is very uneven.',
    detailTitle: 'Detailed Breakdown by Salary',
    tabComparison: 'Comparison',
    tabPisah: 'Pisah Harta Detail',
    tabGabung: 'Gabung Harta Detail',
    tblSalary: 'Salary',
    tblTaxPayables: 'Tax Payables',
    tblDifference: 'Difference',
    tblWinner: 'Winner',
    tblEffRate: 'Effective Rate',
    tblNetIncome: 'Net Income',
    tblPTKP: 'PTKP',
    tblTaxableIncome: 'Taxable Income',
    tblHusband: 'Husband',
    tblWife: 'Wife',
    tblTotalTax: 'Total Tax',
    tblPisah: 'Pisah',
    tblGabung: 'Gabung',
    tblProportional: 'Tax Payables (Proportional)',
    tblSame: '—',
    tblPisahWin: 'Pisah',
    tblGabungWin: 'Gabung',
    warnWife0: "⚠️ With 0% wife income, Pisah Harta wastes wife's PTKP (Rp 54M) entirely. Gabung Harta is strongly recommended.",
    warnHusband0Pre: "⚠️ With 100% wife income (0% husband), Pisah Harta wastes husband's PTKP (K/",
    warnHusband0Post: ') entirely. Gabung Harta is strongly recommended.',
    warnDeductExceed: '⚠️ Deductions (pengurang) exceed gross salary. Net income is set to Rp 0.',
    warnSpouseExceed: '⚠️ One spouse deduction exceeds that spouse gross salary. Net income for that spouse is set to Rp 0.',
  },
  id: {
    subtitle: 'Bandingkan PPh orang pribadi di Indonesia antara skema Pisah Harta dan Gabung Harta.',
    btnBack: '← Alat Lainnya',
    tabInputs: '📊 Masukan',
    tabAdvanced: '📋 PTKP & Lapisan Pajak',
    dependentsLabel: 'Jumlah Tanggungan',
    dep0: '0 — tidak ada tanggungan',
    dep1: '1 — satu anak',
    dep2: '2 — dua anak',
    dep3: '3 — tiga anak',
    inputMethodLabel: 'Cara Input Penghasilan',
    modeTotalBtn: 'Total + % Bagi',
    modeSplitBtn: 'Suami + Istri',
    totalSalaryLabel: 'Total Gaji Kotor Rumah Tangga',
    totalSalaryTip: 'Total gaji kotor tahunan suami dan istri.',
    wifeShareLabel: 'Porsi penghasilan istri',
    wifeShareTip: 'Persentase dari total gaji rumah tangga yang diperoleh istri. Suami memperoleh sisanya.',
    deductionLabel: 'Total Potongan Tahunan (Pengurang)',
    deductionTip: 'Biaya jabatan, iuran pensiun, atau pengurang lain yang diperbolehkan. Diterapkan pada penghasilan kotor sebelum PTKP. Dibagi secara proporsional sesuai porsi penghasilan masing-masing.',
    husbandSalaryLabel: 'Gaji Kotor Suami',
    wifeSalaryLabel: 'Gaji Kotor Istri',
    combinedPrefix: 'Total:',
    wifeSharePrefix: 'Porsi istri:',
    husbandDeductionLabel: 'Potongan Tahunan Suami (Pengurang)',
    husbandDeductionTip: 'Hanya diterapkan pada penghasilan kotor suami sebelum PTKP.',
    wifeDeductionLabel: 'Potongan Tahunan Istri (Pengurang)',
    wifeDeductionTip: 'Hanya diterapkan pada penghasilan kotor istri sebelum PTKP.',
    ptkpSectionLabel: 'Nilai PTKP (Rp)',
    ptkpTK0: 'TK/0 — Tidak Kawin (dasar)',
    ptkpK: 'K — Tambahan Kawin',
    ptkpI: 'I — Tambahan Istri/Suami Bekerja',
    ptkpDep: 'Per tanggungan',
    ptkpComputedPrefix: 'PTKP dihitung → Pisah:',
    ptkpHLabel: '(S)',
    ptkpWLabel: '(I)',
    ptkpGLabel: 'Gabung:',
    bracketSectionLabel: 'Lapisan Tarif PPh 21',
    bracketFrom: 'Dari (Rp)',
    bracketToHtml: 'Sampai (Rp) <span style="font-size:0.68rem">(kosong=∞)</span>',
    bracketRate: 'Tarif (%)',
    bracketTip: 'Edit ambang batas dan tarif. Kolom "Dari" dikelola otomatis. Lapisan terakhir tidak punya batas atas.',
    infoBoxHtml: '<strong>Pisah Harta (K/0 + TK/0):</strong> Masing-masing pasangan mengajukan SPT sendiri. Suami menggunakan PTKP K/tanggungan, istri menggunakan PTKP TK/0. Keduanya mengakses lapisan tarif secara terpisah.<br><br><strong>Gabung Harta (K/I/0):</strong> Penghasilan digabung dalam satu SPT bersama. Menggunakan PTKP K/I/tanggungan. Satu tangga lapisan tarif untuk seluruh penghasilan.',
    resetBtn: '↺ Atur Ulang',
    kpiPisahLabel: 'Pisah Harta — Total Pajak',
    kpiGabungLabel: 'Gabung Harta — Total Pajak',
    kpiSavingLabel: 'Penghematan Pajak',
    effectiveRate: 'Tarif Efektif:',
    noSignificantDiff: 'Tidak ada perbedaan signifikan',
    pisahWins: '✅ Pisah Harta lebih hemat',
    gabungWins: '✅ Gabung Harta lebih hemat',
    posTitle: '📍 Posisi Pajak Anda Saat Ini',
    posMaxMarginal: 'Tarif Marginal Tertinggi',
    posEffPisah: 'Tarif Efektif — Pisah',
    posEffGabung: 'Tarif Efektif — Gabung',
    margFrom: 'dari',
    chart1Title: 'Total Pajak berdasarkan Gaji Rumah Tangga',
    chart1Sub: 'Menampilkan total pajak terutang di berbagai tingkat gaji. Selisih antar garis = penghematan pajak.',
    chart1XTitle: 'Total Gaji Rumah Tangga',
    chart1YTitle: 'Total Pajak Terutang',
    resetZoom: '⟳',
    hoverBox1: 'Arahkan kursor ke grafik untuk melihat detail gaji.',
    chart2Title: 'Selisih Pajak (Gabung − Pisah)',
    chart2Sub: 'Positif = Gabung Harta bayar lebih banyak (Pisah Harta menang). Negatif = Gabung Harta bayar lebih sedikit (Gabung Harta menang).',
    chart2YTitle: 'Selisih Pajak (positif = Pisah menang)',
    hoverBox2: 'Arahkan kursor ke grafik untuk melihat selisihnya.',
    legendPisah: 'Pisah Harta (K/0 + TK/0)',
    legendGabung: 'Gabung Harta (K/I/0)',
    legendPisahWins: 'Pisah Harta menang (positif)',
    legendGabungWins: 'Gabung Harta menang (negatif)',
    salaryLabel: 'Gaji',
    pisahSavesPrefix: 'Pisah hemat:',
    gabungSavesPrefix: 'Gabung hemat:',
    summaryTitle: 'Ringkasan pada Gaji Saat Ini',
    crossoverTitle: 'Analisis Breakeven',
    tilePtkpHusband: 'PTKP Suami (Pisah)',
    tilePtkpWife: 'PTKP Istri (Pisah)',
    tileTotalPtkpPisah: 'Total PTKP Pisah',
    tileGrossalary: 'Gaji Kotor',
    tileGrosssalary: 'Gaji Kotor',
    tileDeductions: 'Potongan (Pengurang)',
    tileNetIncome: 'Penghasilan Bersih (setelah potongan)',
    tileHusbandNet: 'Penghasilan Bersih Suami',
    tileWifeNet: 'Penghasilan Bersih Istri',
    crossoverWith: 'Dengan',
    crossoverWifePct: '% penghasilan istri:',
    crossoverWastedHtml: 'PTKP pasangan yang tidak berpenghasilan terbuang sia-sia dalam skema Pisah Harta. Gabung Harta menggabungkan semua PTKP dalam satu SPT, sehingga lebih <span class="negative">menguntungkan</span> pada pembagian ini.',
    crossoverAdjust: 'Ubah pembagian penghasilan untuk melihat di mana Pisah Harta menjadi lebih menguntungkan berkat akses lapisan tarif ganda.',
    crossoverPoint: 'Breakeven:',
    crossoverBelowPre: 'Di bawah gaji ini, <span class="negative">Gabung Harta (K/I/',
    crossoverBelowPost: ')</span> bisa lebih hemat karena PTKP gabungan yang lebih besar dimanfaatkan lebih efisien relatif terhadap penghasilan.',
    crossoverAbovePre: 'Di atas gaji ini, <span class="positive">Pisah Harta (K/',
    crossoverAbovePost: '+ TK/0)</span> lebih unggul karena masing-masing pasangan mengakses lapisan tarif yang lebih rendah secara terpisah.',
    crossoverNoneFound: 'Tidak ditemukan breakeven dalam rentang ini.',
    crossoverPisahBetterPre: 'Pada pembagian penghasilan ini (',
    crossoverPisahBetterPost: '%), <span class="positive">Pisah Harta</span> lebih baik (atau sama) di seluruh rentang gaji. Kedua skema memiliki total PTKP yang sama pada pembagian merata, namun Pisah Harta diuntungkan oleh akses lapisan tarif ganda.',
    crossoverGabungBetterHtml: 'Pada pembagian penghasilan ini, <span class="negative">Gabung Harta</span> tampak lebih menguntungkan di seluruh rentang. Hal ini umumnya terjadi ketika pembagian penghasilan sangat tidak merata.',
    detailTitle: 'Rincian Detail per Gaji',
    tabComparison: 'Perbandingan',
    tabPisah: 'Detail Pisah Harta',
    tabGabung: 'Detail Gabung Harta',
    tblSalary: 'Gaji',
    tblTaxPayables: 'Pajak Terutang',
    tblDifference: 'Selisih',
    tblWinner: 'Lebih Hemat',
    tblEffRate: 'Tarif Efektif',
    tblNetIncome: 'Penghasilan Bersih',
    tblPTKP: 'PTKP',
    tblTaxableIncome: 'Penghasilan Kena Pajak',
    tblHusband: 'Suami',
    tblWife: 'Istri',
    tblTotalTax: 'Total Pajak',
    tblPisah: 'Pisah',
    tblGabung: 'Gabung',
    tblProportional: 'Pajak Terutang (Proporsional)',
    tblSame: '—',
    tblPisahWin: 'Pisah',
    tblGabungWin: 'Gabung',
    warnWife0: '⚠️ Dengan 0% penghasilan istri, PTKP istri (Rp 54 juta) terbuang sia-sia dalam Pisah Harta. Gabung Harta sangat disarankan.',
    warnHusband0Pre: '⚠️ Dengan 100% penghasilan istri (suami 0%), PTKP suami (K/',
    warnHusband0Post: ') terbuang sia-sia dalam Pisah Harta. Gabung Harta sangat disarankan.',
    warnDeductExceed: '⚠️ Potongan (pengurang) melebihi gaji kotor. Penghasilan bersih ditetapkan Rp 0.',
    warnSpouseExceed: '⚠️ Potongan salah satu pasangan melebihi gaji kotor pasangan tersebut. Penghasilan bersih pasangan itu ditetapkan Rp 0.',
  }
};

let lang = (window.DEFAULT_LANG === 'id') ? 'id' : 'en';
function T(key){ return LANG[lang][key] || LANG['en'][key] || key; }

function applyLang() {
  // Static text nodes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = LANG[lang][key];
    if (val !== undefined) el.textContent = val;
  });
  // Select options
  document.querySelectorAll('[data-i18n-opt]').forEach(el => {
    const key = el.dataset.i18nOpt;
    const val = LANG[lang][key];
    if (val !== undefined) el.textContent = val;
  });
  // Tooltip text
  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    const key = el.dataset.i18nTip;
    const val = LANG[lang][key];
    if (val !== undefined) el.setAttribute('data-tip', val);
  });
  // Info box (HTML)
  $('infoBoxContent').innerHTML = T('infoBoxHtml');
  // Bracket column headers
  $('bracketColFrom').textContent = T('bracketFrom');
  $('bracketColTo').innerHTML = T('bracketToHtml');
  $('bracketColRate').textContent = T('bracketRate');
}

/* ── Formatters ── */
const fmt = {
  idr(v, compact=false){
    const n=Number(v||0);const abs=Math.abs(n);const sign=n<0?'−':'';
    if(compact&&abs>=1e12) return sign+'Rp '+(abs/1e12).toFixed(2)+'T';
    if(compact&&abs>=1e9) return sign+'Rp '+(abs/1e9).toFixed(2)+'B';
    if(compact&&abs>=1e6) return sign+'Rp '+(abs/1e6).toFixed(1)+'M';
    if(compact&&abs>=1e3) return sign+'Rp '+(abs/1e3).toFixed(0)+'K';
    return sign+'Rp '+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});
  },
  pct(v,d=2){const n=Number(v||0);const p=Math.abs(n)<=1?n*100:n;return p.toFixed(d)+'%';},
  num(v,d=0){return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});},
  salaryLabel(mio){
    if(mio>=1000) return 'Rp '+(mio/1000).toFixed(mio%1000===0?0:1)+'B';
    return 'Rp '+fmt.num(mio)+'M';
  }
};

/* ── Tax constants ── */
const PTKP_BASE_DEFAULT    = 54000000;
const PTKP_MARRIED_DEFAULT = 4500000;
const PTKP_SPOUSE_DEFAULT  = 54000000;
const PTKP_DEPENDENT_DEFAULT = 4500000;

const BRACKETS_DEFAULT = [
  { from:0,         to: 60000000,    rate: 0.05 },
  { from:60000001,  to: 250000000,   rate: 0.15 },
  { from:250000001, to: 500000000,   rate: 0.25 },
  { from:500000001, to: 5000000000,  rate: 0.30 },
  { from:5000000001,to: null,        rate: 0.35 },
];

function calcTaxProgressive(income) {
  if (income <= 0) return 0;
  let tax = 0;
  let remaining = income;
  let prev = 0;
  for (const b of S.brackets) {
    const top = b.to !== null ? b.to : Infinity;
    // Guard against a mis-ordered ladder (a bracket whose upper bound sits below
    // the previous one): a negative width would otherwise subtract tax.
    const width = Math.max(0, top - prev);
    const chunk = Math.min(remaining, width);
    tax += chunk * b.rate;
    remaining -= chunk;
    prev = top;
    if (remaining <= 0) break;
  }
  return tax;
}

function marginalBracket(income) {
  if (income <= 0) return S.brackets[0];
  for (let i = S.brackets.length - 1; i >= 0; i--) {
    if (income > S.brackets[i].from) return S.brackets[i];
  }
  return S.brackets[0];
}

const DEFAULTS = {
  dependents: 0,
  splitPct: 50,
  totalSalary: 500000000,
  deduction: 0,
  husbandDeduction: 0,
  wifeDeduction: 0,
  inputMode: 'total',
  husbandSalary: 250000000,
  wifeSalary: 250000000,
  ptkpBase: PTKP_BASE_DEFAULT,
  ptkpMarried: PTKP_MARRIED_DEFAULT,
  ptkpSpouse: PTKP_SPOUSE_DEFAULT,
  ptkpDependent: PTKP_DEPENDENT_DEFAULT,
  brackets: JSON.parse(JSON.stringify(BRACKETS_DEFAULT)),
};

let S = JSON.parse(JSON.stringify(DEFAULTS));

const els = {
  dependents: $('dependents'),
  splitPct: $('splitPct'),
  totalSalaryInput: $('totalSalaryInput'),
  husbandSalaryInput: $('husbandSalaryInput'),
  wifeSalaryInput: $('wifeSalaryInput'),
  deductionInput: $('deductionInput'),
  husbandDeductionInput: $('husbandDeductionInput'),
  wifeDeductionInput: $('wifeDeductionInput'),
  resetBtn: $('resetBtn'),
  chart1PngBtn: $('chart1PngBtn'),
  chart1CopyPngBtn: $('chart1CopyPngBtn'),
  chart1SvgBtn: $('chart1SvgBtn'),
  chart2PngBtn: $('chart2PngBtn'),
  chart2CopyPngBtn: $('chart2CopyPngBtn'),
  chart2SvgBtn: $('chart2SvgBtn'),
  downloadBtn: $('downloadBtn'),
  bracketsContainer: $('bracketsContainer'),
  ptkpBase: $('ptkpBase'),
  ptkpMarried: $('ptkpMarried'),
  ptkpSpouse: $('ptkpSpouse'),
  ptkpDependent: $('ptkpDependent'),
};

let latestRows = [];
let activeTab = 'comparison';
let chartInstance = null;
let chartInstance2 = null;

function cssVar(name){return getComputedStyle(document.body).getPropertyValue(name).trim();}

function readInputs(){
  S.dependents = parseInt(els.dependents.value)||0;
  S.ptkpBase      = parseInt(els.ptkpBase.value.replace(/[^0-9]/g,''))||PTKP_BASE_DEFAULT;
  S.ptkpMarried   = parseInt(els.ptkpMarried.value.replace(/[^0-9]/g,''))||PTKP_MARRIED_DEFAULT;
  S.ptkpSpouse    = parseInt(els.ptkpSpouse.value.replace(/[^0-9]/g,''))||PTKP_SPOUSE_DEFAULT;
  S.ptkpDependent = parseInt(els.ptkpDependent.value.replace(/[^0-9]/g,''))||PTKP_DEPENDENT_DEFAULT;

  if (S.inputMode === 'individual') {
    S.husbandSalary = Math.max(0, SharedFmt.parseFormatted(els.husbandSalaryInput.value));
    S.wifeSalary = Math.max(0, SharedFmt.parseFormatted(els.wifeSalaryInput.value));
    S.husbandDeduction = Math.max(0, SharedFmt.parseFormatted(els.husbandDeductionInput.value));
    S.wifeDeduction = Math.max(0, SharedFmt.parseFormatted(els.wifeDeductionInput.value));
    S.totalSalary = S.husbandSalary + S.wifeSalary;
    S.deduction = S.husbandDeduction + S.wifeDeduction;
    S.splitPct = S.totalSalary > 0 ? Math.round((S.wifeSalary / S.totalSalary) * 100) : 50;
    $('combinedLabel').textContent = 'Rp ' + S.totalSalary.toLocaleString('en-US');
    $('splitDerivedLabel').textContent = (S.totalSalary > 0 ? (S.wifeSalary/S.totalSalary*100).toFixed(1) : '50.0') + '%';
  } else {
    S.splitPct = Math.max(0,Math.min(100,parseFloat(els.splitPct.value)||0));
    S.totalSalary = Math.max(0, SharedFmt.parseFormatted(els.totalSalaryInput.value));
    S.husbandDeduction = 0;
    S.wifeDeduction = 0;
    S.deduction = Math.max(0, SharedFmt.parseFormatted(els.deductionInput.value));
  }
}

function refreshSliderLabels(){
  const sv=$('splitValue');
  if(sv) sv.textContent = S.splitPct + '%';
}

function computeModel() {
  const dep = S.dependents;
  const wifePct = S.splitPct / 100;
  const husbandPct = 1 - wifePct;

  const ptkpHusband_pisah = S.ptkpBase + S.ptkpMarried + dep * S.ptkpDependent;
  const ptkpWife_pisah    = S.ptkpBase;
  const ptkpGabung        = S.ptkpBase + S.ptkpMarried + S.ptkpSpouse + dep * S.ptkpDependent;

  if($('ptkpHDisplay')) $('ptkpHDisplay').textContent = fmt.idr(ptkpHusband_pisah,true);
  if($('ptkpWDisplay')) $('ptkpWDisplay').textContent = fmt.idr(ptkpWife_pisah,true);
  if($('ptkpGDisplay')) $('ptkpGDisplay').textContent = fmt.idr(ptkpGabung,true);

  const totalDeductionRate = S.totalSalary > 0 ? S.deduction / S.totalSalary : 0;
  const husbandDeductionRate = S.inputMode === 'individual'
    ? (S.husbandSalary > 0 ? S.husbandDeduction / S.husbandSalary : 0)
    : totalDeductionRate;
  const wifeDeductionRate = S.inputMode === 'individual'
    ? (S.wifeSalary > 0 ? S.wifeDeduction / S.wifeSalary : 0)
    : totalDeductionRate;

  const rows = [];
  const salaries = [];
  for(let s=100;s<=1000;s+=20) salaries.push(s);
  for(let s=1100;s<=5000;s+=100) salaries.push(s);

  for (const salMio of salaries) {
    const totalGross = salMio * 1e6;
    const wifeGross = totalGross * wifePct;
    const husbandGross = totalGross * husbandPct;
    const husbandDeduction = husbandGross * husbandDeductionRate;
    const wifeDeduction = wifeGross * wifeDeductionRate;
    const totalDeduction = husbandDeduction + wifeDeduction;
    const husbandNet = Math.max(0, husbandGross - husbandDeduction);
    const wifeNet = Math.max(0, wifeGross - wifeDeduction);
    const netIncome = husbandNet + wifeNet;

    const taxableH_p = Math.max(0, husbandNet - ptkpHusband_pisah);
    const taxableW_p = Math.max(0, wifeNet - ptkpWife_pisah);
    const taxH_p = calcTaxProgressive(taxableH_p);
    const taxW_p = calcTaxProgressive(taxableW_p);
    const totalTax_p = taxH_p + taxW_p;

    const taxableG = Math.max(0, netIncome - ptkpGabung);
    const totalTax_g = calcTaxProgressive(taxableG);
    const taxH_g = netIncome > 0 ? totalTax_g * (husbandNet / netIncome) : 0;
    const taxW_g = netIncome > 0 ? totalTax_g * (wifeNet / netIncome) : 0;

    const diff = totalTax_g - totalTax_p;

    rows.push({
      salary: salMio, totalGross, totalDeduction, netIncome,
      pisahTax: totalTax_p, gabungTax: totalTax_g, diff,
      pisahRate: totalGross > 0 ? totalTax_p / totalGross : 0,
      gabungRate: totalGross > 0 ? totalTax_g / totalGross : 0,
      husbandGross, wifeGross,
      husbandNet, wifeNet,
      ptkpH: ptkpHusband_pisah, ptkpW: ptkpWife_pisah,
      taxableH: taxableH_p, taxableW: taxableW_p,
      taxH: taxH_p, taxW: taxW_p,
      ptkpGabung, taxableGabung: taxableG,
      taxH_g, taxW_g,
    });
  }

  let crossover = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i-1].diff * rows[i].diff < 0) {
      const r0=rows[i-1], r1=rows[i];
      crossover = r0.salary + (r1.salary - r0.salary) * Math.abs(r0.diff) / (Math.abs(r0.diff) + Math.abs(r1.diff));
      break;
    }
  }

  // In "Husband + Wife" mode tax the exact salaries the user typed. splitPct is
  // rounded to a whole percent for the sweep chart, so deriving the grosses from
  // it here would tax slightly-wrong amounts.
  const currentHusbandGross = S.inputMode === 'individual' ? S.husbandSalary : S.totalSalary * husbandPct;
  const currentWifeGross    = S.inputMode === 'individual' ? S.wifeSalary    : S.totalSalary * wifePct;
  const currentHusbandDeduction = S.inputMode === 'individual' ? S.husbandDeduction : S.deduction * husbandPct;
  const currentWifeDeduction = S.inputMode === 'individual' ? S.wifeDeduction : S.deduction * wifePct;
  const curHusbandNet = Math.max(0, currentHusbandGross - currentHusbandDeduction);
  const curWifeNet = Math.max(0, currentWifeGross - currentWifeDeduction);
  const currentNet = curHusbandNet + curWifeNet;

  const curTxH_p = Math.max(0, curHusbandNet - ptkpHusband_pisah);
  const curTxW_p = Math.max(0, curWifeNet - ptkpWife_pisah);
  const curTaxH_p = calcTaxProgressive(curTxH_p);
  const curTaxW_p = calcTaxProgressive(curTxW_p);
  const curTaxP = curTaxH_p + curTaxW_p;

  const curTxG = Math.max(0, currentNet - ptkpGabung);
  const curTaxG = calcTaxProgressive(curTxG);

  const maxTaxableForMarginal = Math.max(curTxH_p, curTxW_p, curTxG);
  const marginal = marginalBracket(maxTaxableForMarginal);

  const current = {
    totalGross: S.totalSalary, totalDeduction: S.deduction, netIncome: currentNet,
    pisahTax: curTaxP, gabungTax: curTaxG, diff: curTaxG - curTaxP,
    pisahRate: S.totalSalary > 0 ? curTaxP / S.totalSalary : 0,
    gabungRate: S.totalSalary > 0 ? curTaxG / S.totalSalary : 0,
    husbandGross: currentHusbandGross, wifeGross: currentWifeGross,
    husbandNet: curHusbandNet, wifeNet: curWifeNet,
    ptkpH: ptkpHusband_pisah, ptkpW: ptkpWife_pisah, ptkpGabung,
    taxableH: curTxH_p, taxableW: curTxW_p, taxableGabung: curTxG,
    marginalRate: marginal.rate,
    marginalBracketFrom: marginal.from,
  };

  return { rows, summary: { current, crossover, ptkpH: ptkpHusband_pisah, ptkpW: ptkpWife_pisah, ptkpGabung } };
}

/* ── Charts ── */
function buildLegend(id, series){
  const el=$(id);el.innerHTML='';
  series.forEach(s=>{
    const item=document.createElement('div');item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${cssVar(s.colorVar)}"></span><span>${s.label}</span>`;
    el.appendChild(item);
  });
}

function renderMainChart(rows){
  const series=[
    {key:'pisahTax',colorVar:'--line-a',label:T('legendPisah')},
    {key:'gabungTax',colorVar:'--line-b',label:T('legendGabung')},
  ];
  buildLegend('chartLegend',series);
  const labels=rows.map(r=>r.salary);
  const datasets=series.map(s=>({
    label:s.label,data:rows.map(r=>r[s.key]??0),
    borderColor:cssVar(s.colorVar),backgroundColor:cssVar(s.colorVar)+'22',
    borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:0.3,fill:false,
  }));
  const gridColor=cssVar('--chart-grid'),mutedColor=cssVar('--chart-text'),textColor=cssVar('--text');
  const config={
    type:'line',data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,animation:{duration:300},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title:ctx=>T('salaryLabel')+' '+fmt.salaryLabel(ctx[0].label),
            label:ctx=>'  '+ctx.dataset.label.split('(')[0].trim()+': '+fmt.idr(ctx.parsed.y,true),
          },
          backgroundColor:cssVar('--panel-raised'),titleColor:textColor,bodyColor:mutedColor,borderColor:gridColor,borderWidth:1,padding:10,
          onAfterBody:(items)=>{
            if(!items.length)return;
            const parts=items.map(i=>i.dataset.label.split('(')[0].trim()+': '+fmt.idr(i.parsed.y,true)).join('  |  ');
            $('hoverBox').textContent=T('salaryLabel')+' '+fmt.salaryLabel(items[0].label)+'  —  '+parts;
          }
        },
        zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:0.08},pinch:{enabled:true},mode:'x'}},
      },
      scales:{
        x:{ticks:{color:mutedColor,maxTicksLimit:12,font:{size:11},callback:(v,i)=>fmt.salaryLabel(labels[i])},grid:{color:gridColor},title:{display:true,text:T('chart1XTitle'),color:mutedColor}},
        y:{ticks:{color:mutedColor,font:{size:11},callback:v=>fmt.idr(v,true)},grid:{color:gridColor},title:{display:true,text:T('chart1YTitle'),color:mutedColor}},
      }
    }
  };
  if(chartInstance){
    chartInstance.data.labels=labels;chartInstance.data.datasets=datasets;
    chartInstance.options.scales.x.ticks.color=mutedColor;chartInstance.options.scales.x.grid.color=gridColor;
    chartInstance.options.scales.x.title.text=T('chart1XTitle');
    chartInstance.options.scales.y.ticks.color=mutedColor;chartInstance.options.scales.y.grid.color=gridColor;
    chartInstance.options.scales.y.title.text=T('chart1YTitle');
    chartInstance.update('none');
  } else {
    chartInstance=new Chart($('chartCanvas'),config);
  }
}

function renderDiffChart(rows){
  buildLegend('chartLegend2',[
    {colorVar:'--line-a',label:T('legendPisahWins')},
    {colorVar:'--line-b',label:T('legendGabungWins')},
  ]);
  const labels=rows.map(r=>r.salary);
  const diffData=rows.map(r=>r.diff);
  const gridColor=cssVar('--chart-grid'),mutedColor=cssVar('--chart-text'),textColor=cssVar('--text');
  const config={
    type:'line',
    data:{labels,datasets:[
      {label:T('legendPisahWins'),data:diffData.map(d=>d>=0?d:null),borderColor:cssVar('--line-a'),backgroundColor:cssVar('--line-a')+'22',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:0.3,fill:false,spanGaps:false},
      {label:T('legendGabungWins'),data:diffData.map(d=>d<0?d:null),borderColor:cssVar('--line-b'),backgroundColor:cssVar('--line-b')+'22',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:0.3,fill:false,spanGaps:false},
      {label:'Full line',data:diffData,borderColor:cssVar('--muted')+'44',borderWidth:1,pointRadius:0,tension:0.3,fill:false,borderDash:[4,4]},
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,animation:{duration:300},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title:ctx=>T('salaryLabel')+' '+fmt.salaryLabel(ctx[0].label),
            label:ctx=>{
              if(ctx.datasetIndex===2)return null;
              const v=ctx.parsed.y;if(v==null)return null;
              return v>=0?'  '+T('pisahSavesPrefix')+' '+fmt.idr(v,true):'  '+T('gabungSavesPrefix')+' '+fmt.idr(-v,true);
            },
          },
          filter:item=>item.datasetIndex<2&&item.parsed.y!=null,
          backgroundColor:cssVar('--panel-raised'),titleColor:textColor,bodyColor:mutedColor,borderColor:gridColor,borderWidth:1,padding:10,
          onAfterBody:(items)=>{
            if(!items.length)return;
            const v=rows[items[0].dataIndex]?.diff||0;
            $('hoverBox2').textContent=T('salaryLabel')+' '+fmt.salaryLabel(items[0].label)+'  —  '+(v>=0?T('pisahSavesPrefix')+' '+fmt.idr(v,true):T('gabungSavesPrefix')+' '+fmt.idr(-v,true));
          }
        },
        zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:0.08},pinch:{enabled:true},mode:'x'}},
      },
      scales:{
        x:{ticks:{color:mutedColor,maxTicksLimit:12,font:{size:11},callback:(v,i)=>fmt.salaryLabel(labels[i])},grid:{color:gridColor},title:{display:true,text:T('chart1XTitle'),color:mutedColor}},
        y:{ticks:{color:mutedColor,font:{size:11},callback:v=>fmt.idr(v,true)},grid:{color:gridColor},title:{display:true,text:T('chart2YTitle'),color:mutedColor}},
      }
    }
  };
  if(chartInstance2){
    chartInstance2.data.labels=labels;chartInstance2.data.datasets=config.data.datasets;
    chartInstance2.options.scales.x.ticks.color=mutedColor;chartInstance2.options.scales.x.grid.color=gridColor;
    chartInstance2.options.scales.x.title.text=T('chart1XTitle');
    chartInstance2.options.scales.y.ticks.color=mutedColor;chartInstance2.options.scales.y.grid.color=gridColor;
    chartInstance2.options.scales.y.title.text=T('chart2YTitle');
    chartInstance2.update('none');
  } else {
    chartInstance2=new Chart($('chartCanvas2'),config);
  }
}

function updateKPIs(state){
  const c=state.summary.current;
  $('kpiPisah').textContent=fmt.idr(c.pisahTax,true);
  $('kpiPisahRate').textContent=T('effectiveRate')+' '+fmt.pct(c.pisahRate);
  $('kpiGabung').textContent=fmt.idr(c.gabungTax,true);
  $('kpiGabungRate').textContent=T('effectiveRate')+' '+fmt.pct(c.gabungRate);

  const diff=c.diff;
  const absDiff=Math.abs(diff);
  if(absDiff<1000){
    $('kpiSaving').textContent='≈ Rp 0';
    $('kpiSaving').className='value';
    $('kpiWinner').textContent=T('noSignificantDiff');
  } else if(diff>0){
    $('kpiSaving').textContent=fmt.idr(absDiff,true);
    $('kpiSaving').className='value positive';
    $('kpiWinner').textContent=T('pisahWins');
  } else {
    $('kpiSaving').textContent=fmt.idr(absDiff,true);
    $('kpiSaving').className='value negative';
    $('kpiWinner').textContent=T('gabungWins');
  }

  $('posP_ptkpH').textContent = fmt.idr(c.ptkpH, true);
  $('posP_ptkpW').textContent = fmt.idr(c.ptkpW, true);
  $('posG_ptkp').textContent  = fmt.idr(c.ptkpGabung, true);
  const margRate = (c.marginalRate * 100).toFixed(0) + '%';
  const margFrom = fmt.idr(c.marginalBracketFrom, true);
  $('posMarginBracket').textContent = margRate + ' (' + T('margFrom') + ' ' + margFrom + ')';
  $('posEffPisah').textContent  = fmt.pct(c.pisahRate);
  $('posEffGabung').textContent = fmt.pct(c.gabungRate);
}

function updateSummary(state){
  const c=state.summary.current;
  const s=state.summary;
  const grid=$('summaryGrid');
  const tiles=[
    {label:T('tilePtkpHusband'),value:fmt.idr(s.ptkpH,true)},
    {label:T('tilePtkpWife'),value:fmt.idr(s.ptkpW,true)},
    {label:T('tileTotalPtkpPisah'),value:fmt.idr(s.ptkpH+s.ptkpW,true)},
    {label:'PTKP Gabung (K/I/'+S.dependents+')',value:fmt.idr(s.ptkpGabung,true)},
    {label:T('tileGrosssalary'),value:fmt.idr(c.totalGross,true)},
    {label:T('tileDeductions'),value:fmt.idr(c.totalDeduction,true)},
    {label:T('tileNetIncome'),value:fmt.idr(c.netIncome,true)},
    {label:T('tileHusbandNet'),value:fmt.idr(c.husbandNet,true)},
    {label:T('tileWifeNet'),value:fmt.idr(c.wifeNet,true)},
  ];
  grid.innerHTML=tiles.map(t=>`<div class="tile"><div class="label">${t.label}</div><div class="value">${t.value}</div></div>`).join('');

  const info=$('crossoverInfo');
  if(S.splitPct===0 || S.splitPct===100){
    info.innerHTML=`<strong>${T('crossoverWith')} ${S.splitPct}${T('crossoverWifePct')}</strong><br>${T('crossoverWastedHtml')}<br><br>${T('crossoverAdjust')}`;
  } else if(s.crossover){
    info.innerHTML='<strong>'+T('crossoverPoint')+'</strong> ~'+fmt.salaryLabel(Math.round(s.crossover))+'<br><br>'+T('crossoverBelowPre')+S.dependents+T('crossoverBelowPost')+'<br><br>'+T('crossoverAbovePre')+S.dependents+'/'+T('crossoverAbovePost');
  } else {
    const last=state.rows[state.rows.length-1];
    if(last.diff>=0){
      info.innerHTML='<strong>'+T('crossoverNoneFound')+'</strong><br><br>'+T('crossoverPisahBetterPre')+S.splitPct+T('crossoverPisahBetterPost');
    } else {
      info.innerHTML='<strong>'+T('crossoverNoneFound')+'</strong><br><br>'+T('crossoverGabungBetterHtml');
    }
  }
}

function updateDetailTable(rows){
  const wrap=$('detailTable');
  const milestones=[100,150,200,250,300,400,500,600,750,1000,1250,1500,2000,2500,3000,4000,5000];
  const filtered=milestones.map(m=>rows.find(r=>r.salary>=m)).filter(Boolean);
  const seen=new Set();const unique=[];
  filtered.forEach(r=>{if(!seen.has(r.salary)){seen.add(r.salary);unique.push(r);}});

  if(activeTab==='comparison'){
    wrap.innerHTML=`<table>
      <thead>
        <tr>
          <th rowspan="2">${T('tblSalary')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblTaxPayables')}</th>
          <th rowspan="2">${T('tblDifference')}</th>
          <th rowspan="2">${T('tblWinner')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblEffRate')}</th>
        </tr>
        <tr>
          <th>${T('tblPisah')}</th>
          <th>${T('tblGabung')}</th>
          <th>${T('tblPisah')}</th>
          <th>${T('tblGabung')}</th>
        </tr>
      </thead>
      <tbody>${unique.map(r=>{
        const d=r.diff;const cls=d>1000?'positive':d<-1000?'negative':'';
        const w=Math.abs(d)<1000?T('tblSame'):d>0?T('tblPisahWin'):T('tblGabungWin');
        return `<tr><td>${fmt.salaryLabel(r.salary)}</td><td>${fmt.idr(r.pisahTax,true)}</td><td>${fmt.idr(r.gabungTax,true)}</td><td class="${cls}">${d>=0?'+':''}${fmt.idr(d,true)}</td><td>${w}</td><td>${fmt.pct(r.pisahRate)}</td><td>${fmt.pct(r.gabungRate)}</td></tr>`;
      }).join('')}</tbody></table>`;
  } else if(activeTab==='pisah'){
    wrap.innerHTML=`<table>
      <thead>
        <tr>
          <th rowspan="2">${T('tblSalary')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblNetIncome')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblPTKP')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblTaxableIncome')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblTaxPayables')}</th>
          <th rowspan="2">${T('tblTotalTax')}</th>
        </tr>
        <tr>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
        </tr>
      </thead>
      <tbody>${unique.map(r=>`<tr><td>${fmt.salaryLabel(r.salary)}</td><td>${fmt.idr(r.husbandNet,true)}</td><td>${fmt.idr(r.wifeNet,true)}</td><td>${fmt.idr(r.ptkpH,true)}</td><td>${fmt.idr(r.ptkpW,true)}</td><td>${fmt.idr(r.taxableH,true)}</td><td>${fmt.idr(r.taxableW,true)}</td><td>${fmt.idr(r.taxH,true)}</td><td>${fmt.idr(r.taxW,true)}</td><td>${fmt.idr(r.pisahTax,true)}</td></tr>`).join('')}</tbody></table>`;
  } else {
    wrap.innerHTML=`<table>
      <thead>
        <tr>
          <th rowspan="2">${T('tblSalary')}</th>
          <th rowspan="2">${T('tblNetIncome')}</th>
          <th rowspan="2">PTKP K/I/${S.dependents}</th>
          <th rowspan="2">${T('tblTaxableIncome')}</th>
          <th rowspan="2">${T('tblTotalTax')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblProportional')}</th>
        </tr>
        <tr>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
        </tr>
      </thead>
      <tbody>${unique.map(r=>`<tr><td>${fmt.salaryLabel(r.salary)}</td><td>${fmt.idr(r.netIncome,true)}</td><td>${fmt.idr(r.ptkpGabung,true)}</td><td>${fmt.idr(r.taxableGabung,true)}</td><td>${fmt.idr(r.gabungTax,true)}</td><td>${fmt.idr(r.taxH_g,true)}</td><td>${fmt.idr(r.taxW_g,true)}</td></tr>`).join('')}</tbody></table>`;
  }
}

/* ── Main loop ── */
function rerender(){
  readInputs();
  refreshSliderLabels();

  const warn=$('capWarning');
  if(S.splitPct===0){
    warn.style.display='block';
    warn.textContent=T('warnWife0');
  } else if(S.splitPct===100){
    warn.style.display='block';
    warn.textContent=T('warnHusband0Pre')+S.dependents+T('warnHusband0Post');
  } else {
    warn.style.display='none';
  }

  if(S.inputMode === 'total' && S.deduction > S.totalSalary){
    warn.style.display='block';
    warn.textContent=T('warnDeductExceed');
  }
  if(S.inputMode === 'individual' && (S.husbandDeduction > S.husbandSalary || S.wifeDeduction > S.wifeSalary)){
    warn.style.display='block';
    warn.textContent=T('warnSpouseExceed');
  }

  const state=computeModel();
  latestRows=state.rows;

  renderMainChart(state.rows);
  renderDiffChart(state.rows);
  updateKPIs(state);
  updateSummary(state);
  updateDetailTable(state.rows);
}

/* ── Reset ── */
function resetAll(){
  S=JSON.parse(JSON.stringify(DEFAULTS));
  S.brackets=JSON.parse(JSON.stringify(BRACKETS_DEFAULT));
  els.dependents.value=DEFAULTS.dependents;
  els.splitPct.value=DEFAULTS.splitPct;
  els.totalSalaryInput.value=DEFAULTS.totalSalary.toLocaleString('en-US');
  els.husbandSalaryInput.value=DEFAULTS.husbandSalary.toLocaleString('en-US');
  els.wifeSalaryInput.value=DEFAULTS.wifeSalary.toLocaleString('en-US');
  els.deductionInput.value='0';
  els.husbandDeductionInput.value='0';
  els.wifeDeductionInput.value='0';
  els.ptkpBase.value=DEFAULTS.ptkpBase.toLocaleString('en-US');
  els.ptkpMarried.value=DEFAULTS.ptkpMarried.toLocaleString('en-US');
  els.ptkpSpouse.value=DEFAULTS.ptkpSpouse.toLocaleString('en-US');
  els.ptkpDependent.value=DEFAULTS.ptkpDependent.toLocaleString('en-US');
  setInputMode('total');
  buildBracketEditor();
  rerender();
}

/* ── Input mode toggle ── */
function setInputMode(mode){
  S.inputMode = mode;
  $('modeTotal').style.display = mode==='total' ? '' : 'none';
  $('modeIndividual').style.display = mode==='individual' ? '' : 'none';
  $('modeBtnTotal').classList.toggle('active', mode==='total');
  $('modeBtnSplit').classList.toggle('active', mode==='individual');
  rerender();
}

/* ── Bracket number formatting helpers ── */
function formatBracketNum(n){ return n===null||n===undefined?'':Number(n).toLocaleString('en-US'); }
function parseBracketNum(str){ return str===''?null:parseInt(str.replace(/[^0-9]/g,''),10)||0; }
function formatBracketInput(el){
  const raw=el.value.replace(/[^0-9]/g,'');
  if(raw===''){el.value='';return;}
  const n=parseInt(raw,10)||0;
  el.value=n.toLocaleString('en-US');
}

/* ── Bracket editor ── */
function buildBracketEditor(){
  const container = els.bracketsContainer;
  container.innerHTML='';
  S.brackets.forEach((b,i)=>{
    const row = document.createElement('div');
    row.className='bracket-row';

    const fromEl = document.createElement('input');
    fromEl.className='num-input-sm';
    fromEl.type='text';
    fromEl.value=formatBracketNum(b.from);
    fromEl.disabled=true;

    const toEl = document.createElement('input');
    toEl.className='num-input-sm';
    toEl.type='text';
    toEl.inputMode='numeric';
    toEl.placeholder='∞';
    if(b.to!==null) toEl.value=formatBracketNum(b.to);
    toEl.disabled=(i===S.brackets.length-1);
    toEl.addEventListener('input',function(){
      const pos=this.selectionStart, oldLen=this.value.length;
      formatBracketInput(this);
      const newLen=this.value.length;
      this.setSelectionRange(Math.max(0,pos+(newLen-oldLen)),Math.max(0,pos+(newLen-oldLen)));
    });
    toEl.addEventListener('change',()=>{
      let newTo=toEl.value===''?null:parseBracketNum(toEl.value);
      // Keep the ladder monotonic: an upper bound can't drop below this bracket's
      // own lower bound (which is the previous bracket's "to" + 1).
      if(newTo!==null) newTo=Math.max(newTo, S.brackets[i].from);
      S.brackets[i].to=newTo;
      if(i+1<S.brackets.length&&newTo!==null){
        S.brackets[i+1].from=newTo+1;
      }
      buildBracketEditor();
      rerender();
    });

    const rateEl = document.createElement('input');
    rateEl.className='num-input-sm';
    rateEl.type='number';
    rateEl.min=0;rateEl.max=100;rateEl.step=0.5;
    rateEl.value=(b.rate*100).toFixed(1);
    rateEl.addEventListener('change',()=>{
      S.brackets[i].rate=Math.max(0,Math.min(100,parseFloat(rateEl.value)||0))/100;
      rerender();
    });

    row.appendChild(fromEl);
    row.appendChild(toEl);
    row.appendChild(rateEl);
    container.appendChild(row);
  });
}

/* ── PNG ── */
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
    const wmText = 'Made using tool.adjiebrotots.com/pisahvsgabung';
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

function downloadChartSvg(canvasId, filename, chartTitle, legendId) {
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
els.chart1PngBtn.addEventListener('click', () => downloadChartPng('chartCanvas', 'pisah_vs_gabung_chart1.png', T('chart1Title'), 'chartLegend'));
els.chart1CopyPngBtn.addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('chartCanvas', 'pisah_vs_gabung_chart1.png', T('chart1Title'), 'chartLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
els.chart2PngBtn.addEventListener('click', () => downloadChartPng('chartCanvas2', 'pisah_vs_gabung_chart2.png', T('chart2Title'), 'chartLegend2'));
els.chart2CopyPngBtn.addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('chartCanvas2', 'pisah_vs_gabung_chart2.png', T('chart2Title'), 'chartLegend2', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
els.chart1SvgBtn.addEventListener('click', () => downloadChartSvg('chartCanvas', 'pisah_vs_gabung_chart1.svg', T('chart1Title'), 'chartLegend'));
els.chart2SvgBtn.addEventListener('click', () => downloadChartSvg('chartCanvas2', 'pisah_vs_gabung_chart2.svg', T('chart2Title'), 'chartLegend2'));

/* ── CSV ── */
function downloadCsv(){
  if(!latestRows.length)return;
  const h=['Salary_Mio','HusbandGross','WifeGross','Deduction','NetIncome','PTKP_H_Pisah','PTKP_W_Pisah','TaxableH_Pisah','TaxableW_Pisah','TaxH_Pisah','TaxW_Pisah','TotalTax_Pisah','PTKP_Gabung','Taxable_Gabung','TotalTax_Gabung','Difference','Winner','EffRate_Pisah','EffRate_Gabung'];
  const lines=latestRows.map(r=>{
    const w=Math.abs(r.diff)<1000?'Same':r.diff>0?'Pisah':'Gabung';
    return [r.salary,r.husbandGross,r.wifeGross,r.totalDeduction,r.netIncome,r.ptkpH,r.ptkpW,r.taxableH,r.taxableW,r.taxH,r.taxW,r.pisahTax,r.ptkpGabung,r.taxableGabung,r.gabungTax,r.diff,w,(r.pisahRate*100).toFixed(2)+'%',(r.gabungRate*100).toFixed(2)+'%'].join(',');
  });
  const csv='# Made using tool.adjiebrotots.com/pisahvsgabung\n'+[h.join(','),...lines].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='pisah_vs_gabung_harta.csv';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

/* ── Event wiring ── */
['input','change'].forEach(evt=>{
  els.splitPct.addEventListener(evt,rerender);
});

[els.totalSalaryInput, els.deductionInput, els.husbandSalaryInput, els.wifeSalaryInput, els.husbandDeductionInput, els.wifeDeductionInput].forEach(el=>{
  SharedFmt.attachCurrencyInput(el, {maxDecimals:0, onChange: rerender});
});

[els.ptkpBase, els.ptkpMarried, els.ptkpSpouse, els.ptkpDependent].forEach(el=>{
  el.addEventListener('input',function(){
    const pos=this.selectionStart, oldLen=this.value.length;
    formatBracketInput(this);
    const newLen=this.value.length;
    this.setSelectionRange(Math.max(0,pos+(newLen-oldLen)),Math.max(0,pos+(newLen-oldLen)));
    rerender();
  });
  el.addEventListener('blur',function(){ formatBracketInput(this); rerender(); });
});

$('modeBtnTotal').addEventListener('click',()=>setInputMode('total'));
$('modeBtnSplit').addEventListener('click',()=>setInputMode('individual'));

els.dependents.addEventListener('change',rerender);
els.resetBtn.addEventListener('click',resetAll);
els.downloadBtn.addEventListener('click',downloadCsv);

document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
  });
});

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeTab=btn.dataset.scenario;
    if(latestRows.length)updateDetailTable(latestRows);
  });
});

$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
  if(latestRows&&latestRows.length){
    if(chartInstance){chartInstance.destroy();chartInstance=null;}
    if(chartInstance2){chartInstance2.destroy();chartInstance2=null;}
    rerender();
  }
});

$('chartResetZoom').addEventListener('click',()=>{if(chartInstance)chartInstance.resetZoom();});
$('chartResetZoom2').addEventListener('click',()=>{if(chartInstance2)chartInstance2.resetZoom();});

$('chartCanvas').addEventListener('mouseleave',()=>{$('hoverBox').textContent=T('hoverBox1');});
$('chartCanvas2').addEventListener('mouseleave',()=>{$('hoverBox2').textContent=T('hoverBox2');});

/* ── Init ── */
buildBracketEditor();
rerender();

})();
