"""Write the fixture files the data tests read (a CSV and a workbook with two sheets).

Run from the repository root:  python powerfactory-scripter/builder/_audit/data/make_fixtures.py
"""
import os
from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(HERE, "cases.csv"), "w", encoding="utf-8", newline="") as fh:
    fh.write("Case,Generator,P (MW),Q (Mvar),Note\r\n")
    fh.write("Summer peak,G 01,120.5,30,\"a, with comma\"\r\n")
    fh.write("Winter min,G 02,40,-5,007\r\n")
    fh.write("\r\n")
    fh.write("Shoulder,G 03,80,0,\r\n")

with open(os.path.join(HERE, "cases_semicolon.csv"), "w", encoding="utf-8", newline="") as fh:
    fh.write("Case;P (MW);Q (Mvar)\r\n")
    fh.write("A;120,5;30,25\r\n")
    fh.write("B;40,0;-5,5\r\n")

wb = Workbook()
ws = wb.active
ws.title = "Notes"
ws["A1"] = "not the table"
ws2 = wb.create_sheet("Dispatch")
rows = [
    ["Study", "run on", "", ""],
    ["Case", "G 01 (MW)", "G 02 (MW)", "Scale"],
    ["Max", 150, 90, 1.0],
    ["Min", 20, 0, 0.5],
    [None, None, None, None],
    ["Mid", 85, 45, 0.75],
]
for r in rows:
    ws2.append(r)
wb.save(os.path.join(HERE, "cases.xlsx"))
print("wrote cases.csv, cases_semicolon.csv, cases.xlsx in", HERE)
