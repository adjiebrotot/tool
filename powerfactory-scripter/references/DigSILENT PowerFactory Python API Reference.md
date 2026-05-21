---
title: DigSILENT PowerFactory Python API Reference (AI-Ready)
source_files:
  - PythonReference_en (1).pdf
  - PythonReference_en (2).pdf
product: DIgSILENT PowerFactory 2019
python_interface_version: 2
purpose:
  - Quick AI retrieval
  - Chatbot reference for DigSILENT Python scripting
  - Fast lookup of module functions, application methods, object methods, and common workflows
tags:
  - digsilent
  - powerfactory
  - python
  - api-reference
  - chatbot-training
  - engine-mode
  - load-flow
  - short-circuit
  - rms
  - emt
---

# DigSILENT PowerFactory Python API Reference

> **AI-ready condensed Markdown reference** for DigSILENT PowerFactory Python scripting.
>
> This file is intended to be used as a retrieval-friendly reference for a chatbot. It is structured around the official **PowerFactory 2019 Python Function Reference** and the accompanying **Integration DIgSILENT - Python** introduction slides.

---

## How to Use This Reference

Use this document as the **authoritative retrieval layer** for:

- Python module entry points (`powerfactory`, `GetApplication`, etc.)
- `Application` methods
- generic `DataObject` methods
- common network element methods (`ElmLne`, `ElmTerm`, `ElmTr2`, etc.)
- result handling with `ElmRes`
- common DigSILENT Python integration patterns

### Recommended retrieval strategy

1. Search by **class name** (e.g. `ElmLne`, `ElmTerm`, `ComLdf`)
2. Then search by **method name** (e.g. `GetCalcRelevantObjects`, `GetValue`, `ActivateProject`)
3. If the task is procedural, search by **workflow topic**:
   - `load flow`
   - `short circuit`
   - `engine mode`
   - `results`
   - `study case`
   - `switching`
   - `scenario`

---

## Scope and Source Intent

The official reference describes the syntax of all available functions and methods provided by the **PowerFactory Python module**, using **Python interface version 2**. The introduction slides complement this with a practical explanation of PowerFactory–Python integration, especially **Engine Mode** access and example workflows.

---

## Table of Contents

- [1. Integration Overview](#1-integration-overview)
- [2. PowerFactory Module](#2-powerfactory-module)
- [3. Application Methods](#3-application-methods)
  - [3.1 Project and Session Management](#31-project-and-session-management)
  - [3.2 Calculation and Study Case Access](#32-calculation-and-study-case-access)
  - [3.3 Object and Metadata Access](#33-object-and-metadata-access)
  - [3.4 File System](#34-file-system)
  - [3.5 Date/Time](#35-datetime)
  - [3.6 Dialogue Boxes](#36-dialogue-boxes)
  - [3.7 Environment](#37-environment)
  - [3.8 Mathematics](#38-mathematics)
  - [3.9 Output Window](#39-output-window)
- [4. OutputWindow Object](#4-outputwindow-object)
- [5. DataObject General Methods](#5-dataobject-general-methods)
- [6. Network Element Methods](#6-network-element-methods)
  - [6.1 ElmArea](#61-elmarea)
  - [6.2 ElmAsm / ElmAsmsc](#62-elmasm--elmasmsc)
  - [6.3 ElmBbone](#63-elmbbone)
  - [6.4 ElmBmu](#64-elmbmu)
  - [6.5 ElmBoundary](#65-elmboundary)
  - [6.6 ElmBranch](#66-elmbranch)
  - [6.7 ElmCabsys](#67-elmcabsys)
  - [6.8 ElmComp](#68-elmcomp)
  - [6.9 ElmCoup](#69-elmcoup)
  - [6.10 ElmDsl](#610-elmdsl)
  - [6.11 ElmFeeder](#611-elmfeeder)
  - [6.12 ElmFile](#612-elmfile)
  - [6.13 ElmFilter / ElmGndswt / ElmNec / ElmShnt / ElmVac / ElmVoltreg / ElmXnet](#613-grounding-related-methods)
  - [6.14 ElmGenstat / ElmPvsys / ElmSym](#614-generator-and-pv-related-methods)
  - [6.15 ElmLne / ElmLnesec](#615-elmlne--elmlnesec)
  - [6.16 ElmNet / ElmZone](#616-elmnet--elmzone)
  - [6.17 ElmRelay](#617-elmrelay)
  - [6.18 ElmRes](#618-elmres)
  - [6.19 ElmStactrl](#619-elmstactrl)
  - [6.20 ElmSubstat / ElmTrfstat](#620-elmsubstat--elmtrfstat)
  - [6.21 ElmSvs](#621-elmsvs)
  - [6.22 ElmTerm](#622-elmterm)
  - [6.23 ElmTr2 / ElmTr3 / ElmTr4](#623-elmtr2--elmtr3--elmtr4)
- [7. Station Elements](#7-station-elements)
  - [7.1 StaCt](#71-stact)
  - [7.2 StaCubic](#72-stacubic)
  - [7.3 External Measurement Classes](#73-external-measurement-classes)
- [8. Common Python + PowerFactory Workflow Snippets](#8-common-python--powerfactory-workflow-snippets)
- [9. Chatbot Retrieval Hints](#9-chatbot-retrieval-hints)

---

## 1. Integration Overview

### Python + PowerFactory integration topics from the introduction slides

The introduction slides cover:

- Python installation and setup
- environment compatibility by PowerFactory version
- essential Python libraries
- Python basics
- Python–DigSILENT integration
- `PowerFactorySim` class concept

### Supported Python versions in the slides

- **DIgSILENT 2016** → Python **3.5**
- **DIgSILENT 2018** → Python **3.6**
- **DIgSILENT 2019** → Python **3.7**

### Recommended environment setup in the slides

- Use **Anaconda** for environment management
- Use **Spyder** or **Jupyter Notebook**
- Focus on **Engine Mode** for Python integration

### Essential interface code from the slides

```python
import powerfactory
app = powerfactory.GetApplication()
```

### Conceptual API access provided by the `powerfactory` module

The module gives access to:

- objects
- attributes (element data, results)
- commands (load flow, short-circuit, etc.)
- built-in DPL functions

### Example calculation topics from the slides

- static simulations: load flow
- static simulations: short-circuit
- modal analysis
- quasi-dynamic simulations
- RMS and EMT dynamics (via the `PowerFactorySim` concept)

---

## 2. PowerFactory Module

### Version

- `powerfactory.__version__`  
  Returns the PowerFactory version string (e.g. `17.0.9`).

### Application creation functions

- `powerfactory.GetApplication([username=None, password=None, commandLineArguments=None])`  
  Returns an `Application` object. If run externally, PowerFactory is started.

- `powerfactory.GetApplicationExt([username=None, password=None, commandLineArguments=None])`  
  Same as `GetApplication()` but throws an exception with an error code if startup fails.

- `powerfactory.GetApplicationSecured([username=None, passwordHash=None, commandLineArguments=None])`  
  Same as `GetApplication()` but uses a password hash.

- `powerfactory.GetApplicationSecuredExt([username=None, passwordHash=None, commandLineArguments=None])`  
  Same as `GetApplicationExt()` but uses a password hash.

### External launch example

```python
import sys
sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2017\python\3.6")
import powerfactory

try:
    app = powerfactory.GetApplicationExt()
    # calculations ...
except powerfactory.ExitError as error:
    print(error)
    print('error.code = %d' % error.code)
```

---

## 3. Application Methods

## 3.1 Project and Session Management

- `ActivateProject(name)` — Activate project by name, qualified name, or full path.
- `ClearRecycleBin()` — Clear recycle bin of current user.
- `CommitTransaction()` — Write pending changes to database.
- `CreateProject(projectName, gridName, [parent])` — Create new project and grid.
- `GetActiveProject()` — Return active `IntPrj` object.
- `GetActiveScenario()` — Return active `IntScenario` or `None`.
- `GetActiveScenarioScheduler()` — Return active `IntScensched` or `None`.
- `GetActiveStages([variedFolder])` — Return active stage objects.
- `GetAllUsers([forceReload])` — Return all known users.
- `GetCurrentUser()` — Return session user object.
- `GetProjectFolder(type)` — Return project folder by type.
- `GetRecordingStage()` — Return active recording stage.
- `GetUserManager()` — Return `IntUserman` object.
- `Hide()` — Hide PowerFactory application window.
- `Show()` — Show application window (full license only).
- `SetShowAllUsers(enabled)` — Enable/disable showing all users in Data Manager.

## 3.2 Calculation and Study Case Access

- `GetActiveCalculationStr()` — Return current calculation string, e.g.:
  - `ldf`
  - `shc`
  - `shcfull`
  - `rms`
  - `emt`
  - `modal`
  - `opf`
  - `dcopf`
  - `harm`
  - `fsweep`
  - `rel`
- `GetActiveStudyCase()` — Return active study case (`IntCase`) or `None`.
- `GetActiveNetworkVariations()` — Return active network variation schemes.
- `GetSummaryGrid()` — Return summary grid of active study case.
- `IsLdfValid()` — Check validity of last load-flow results.
- `IsRmsValid()` — Check validity of last RMS results.
- `IsShcValid()` — Check validity of last short-circuit results.
- `IsSimValid()` — Check validity of last simulation results.
- `ResetCalculation()` — Reset calculations and delete calculation results.
- `SaveAsScenario(pName, iSetActive)` — Save operational data / network elements as a new scenario.
- `GetFromStudyCase(ClassName)` — Get or create object from current study case.

## 3.3 Object and Metadata Access

- `DefineTransferAttributes(classname, attributes)` — Define blockwise attribute access for `GetAttributes()` / `SetAttributes()`.
- `GetAttributeDescription(classname, name, short=0)` — Return attribute description.
- `GetAttributeUnit(classname, name)` — Return attribute unit.
- `GetClassDescription(name)` — Return class description.
- `GetClassId(className)` — Return class identifier number.
- `GetBrowserSelection()` — Return objects selected in browser.
- `GetCurrentSelection()` — Return selected objects in browser or diagram.
- `GetDiagramSelection()` — Return selected objects in current diagram.
- `GetCurrentDiagram()` — Return current `IntGrfnet` diagram.
- `GetCurrentScript()` — Return current `ComPython` or `None`.
- `GetCurrentZoomScale()` — Return zoom or scale level.
- `GetCalcRelevantObjects([nameFilter, includeOutOfService=1, topoElementsOnly=0, bAcSchemes=0])` — Return calculation-relevant objects.
- `GetBorderCubicles(element)` — Return border cubicles of parent station.
- `SearchObjectByForeignKey(foreignKey)` — Search for object by foreign key.
- `MarkInGraphics(objects, [searchOpenedDiagramsOnly=0])` — Mark objects in diagrams (GUI mode only).
- `OutputFlexibleData(objects, [flexibleDataPage=''])` — Output flexible data to output window.

## 3.4 File System

- `GetInstallationDirectory()` — Return installation directory.
- `GetTemporaryDirectory()` — Return temporary directory.
- `GetWorkspaceDirectory()` — Return workspace directory.

## 3.5 Date/Time

- `GetStudyTimeObject()` — Return `SetTime` object used by study case.

## 3.6 Dialogue Boxes

> Not supported in GUI-less mode.

- `CloseTableReports()`
- `ShowModalBrowser(objects, [detailMode=0, title='', page=''])`
- `ShowModalSelectBrowser(objects, [title, classFilter, page=''])`
- `ShowModelessBrowser(objects, [detailMode=0, title='', page=''])`
- `UpdateTableReports()`

## 3.7 Environment

- `EchoOff()` / `EchoOn()` — Freeze / re-enable UI.
- `IsAutomaticCalculationResetEnabled()`
- `SetAutomaticCalculationResetEnabled(enabled)`
- `IsFinalEchoOnEnabled()`
- `SetFinalEchoOnEnabled(enabled)`
- `SetGraphicUpdate(enabled)`
- `SetGuiUpdateEnabled(enabled)` — Enable / disable GUI updates during script.
- `SetUserBreakEnabled(enabled)` — Enable / disable Break button.

## 3.8 Mathematics

### Random generators

- `RndSetup(seedAutomatic, [seed], [rngType], [rngNum])`
- `RndGetMethod([rngNum])`
- `RndGetSeed([rngNum])`
- `RndUnifInt(min, max, [rngNum])`
- `RndUnifReal(min, max, [rngNum])`
- `RndNormal(mean, stddev, [rngNum])`
- `RndWeibull(shape, scale, [rngNum])`
- `RndExp(rate, [rngNum])`

### Deprecated random methods

- `GetRandomNumber([x1], [x2])`
- `GetRandomNumberEx(distribution, [p1], [p2])`
- `SetRandomSeed(seed)`

### Matrix operation

- `InvertMatrix(realPart, [imaginaryPart])` — Invert real or complex matrix.

## 3.9 Output Window

- `ClearOutputWindow()`
- `GetOutputWindow()`
- `PrintError(message)`
- `PrintInfo(message)`
- `PrintPlain(message)`
- `PrintWarn(message)`
- `SetOutputWindowState(newState)`

---

## 4. OutputWindow Object

Methods of the `OutputWindow` object:

- `Clear()`
- `GetContent([filter])`
- `Print(message)`
- `Print(type, message)`
- `Save(filePath)`
- `SetState(newState)`

### Message types

- `OutputWindow.MessageType.Plain`
- `OutputWindow.MessageType.Info`
- `OutputWindow.MessageType.Warn`
- `OutputWindow.MessageType.Error`

### Example

```python
import powerfactory
app = powerfactory.GetApplication()
output_window = app.GetOutputWindow()
output_window.Print(powerfactory.OutputWindow.MessageType.Plain, "Hello World!")
```

---

## 5. DataObject General Methods

These methods apply broadly to `DataObject` instances.

### Object lifecycle and copy

- `AddCopy(objectToCopy, [nameParts...])`
- `AddCopy(objectsToCopy)`
- `CreateObject(className, [nameParts...])`
- `Delete()`
- `Move(objectToMove)`
- `Move(objectsToMove)`
- `PasteCopy(objectToCopy, [resetMissingReferences=0])`
- `PasteCopy(objectsToCopy)`
- `CopyData(source)`

### Attributes and metadata

- `GetAttribute(name)`
- `SetAttribute(name, value)`
- `HasAttribute(name)`
- `GetAttributeDescription(name, short=0)`
- `GetAttributeUnit(name)`
- `GetAttributeType(name)`
- `GetAttributeLength(name)`
- `SetAttributeLength(name, length)`
- `GetAttributeShape(name)`
- `SetAttributeShape(name, shape)`
- `GetAttributes()`
- `SetAttributes(values)`
- `GetClassName()`
- `GetFullName([type])`
- `GetCombinedProjectSource()`

### Navigation and hierarchy

- `GetChildren(hiddenMode, [filter], [subfolders])`
- `GetContents([Name], [recursive])`
- `GetParent()`
- `GetReferences([filter='*'], [includeSubsets=0], [includeHiddenObjects=0])`
- `SearchObject(name)`

### Topology and electrical access

- `GetConnectedElements([rBrk], [rDis], [rOut])`
- `GetConnectionCount()`
- `GetControlledNode(bus, [check])`
- `GetCubicle(side)`
- `GetImpedance(refVoltage, [i3Trf])`
- `GetZeroImpedance(refVoltage, [i3Trf])`
- `GetInom([busIndex=0])`
- `GetUnom([busIndex=0])`
- `GetNode(busIndex, [considerSwitches=0])`
- `GetSupplyingSubstations()`
- `GetSupplyingTransformers()`
- `GetSupplyingTrfstations()`
- `GetSystemGrounding()`
- `GetRegion()`

### Operational state

- `IsCalcRelevant()`
- `IsDeleted()`
- `IsEarthed()`
- `IsEnergized()`
- `IsHidden()`
- `IsInFeeder(Feeder, [OptNested=0])`
- `IsNetworkDataFolder()`
- `IsNode()`
- `IsObjectActive(time)`
- `IsObjectModifiedByVariation(considerADD, considerDEL, considerDELTA)`
- `IsOutOfService()`
- `IsReducible()`
- `IsShortCircuited()`
- `HasResults([ibus])`
- `ContainsNonAsciiCharacters()`

### Switching and topology actions

- `SwitchOn([resetRA], [simulateOnly])`
- `SwitchOff([resetRA], [simulateOnly])`
- `Energize([resetRA])`
- `Isolate([resetRA], [isolateCBs])`
- `MarkInGraphics([searchAllDiagramsAndSelect=0])`

### Cleanup and reporting

- `PurgeUnusedObjects()`
- `ReportUnusedObjects()`
- `ReportNonAsciiCharacters()`
- `ReplaceNonAsciiCharacters(map, defaultReplacementCharacter)`
- `WriteChangesToDb()`

### UI methods (GUI mode only)

- `ShowEditDialog()`
- `ShowModalSelectTree([title], [filter])`

---

## 6. Network Element Methods

## 6.1 ElmArea

- `CalculateInterchangeTo(area)`
- `DefineBoundary(shift)`
- `GetAll()`
- `GetBranches()`
- `GetBuses()`
- `GetObjs(classname)`

## 6.2 ElmAsm / ElmAsmsc

### Common methods

- `GetAvailableGenPower()`
- `GetGroundingImpedance(busIdx)`
- `GetStepupTransformer(voltage, swStatus)`

### ElmAsm specific

- `GetElecTorque(speed, uReal, [addZReal], [addZImag])`
- `GetMechTorque(speed, uReal)`
- `GetMotorStartingFlag()`
- `IsPQ()`

## 6.3 ElmBbone

- `CheckBbPath(outputMsg)`
- `GetBbOrder()`
- `GetCompleteBbPath(iReverse, [iStopAtTieOpen=0])`
- `GetFOR()`
- `GetMeanCs()`
- `GetMinCs()`
- `GetTieOpenPoint()`
- `GetTotLength()`
- `HasGnrlMod()`

## 6.4 ElmBmu

- `Apply()`
- `Update()`

## 6.5 ElmBoundary

- `AddCubicle(cubicle, orientation)`
- `CalcShiftedReversedBoundary(shift)`
- `Clear()`
- `GetInterior()`
- `IsSplitting()`
- `Resize(size, name)`
- `Update()`

## 6.6 ElmBranch

- `Update()`

## 6.7 ElmCabsys

- `FitParams()`
- `GetLineCable()`
- `Update()`

## 6.8 ElmComp

- `SlotUpdate()`

## 6.9 ElmCoup

- `Close()`
- `Open()`
- `IsBreaker()`
- `IsClosed()`
- `IsOpen()`
- `GetRemoteBreakers(desiredBreakerState)`

## 6.10 ElmDsl

- `ExportToClipboard([colSeparator], [useLocalHeader])`
- `ExportToFile(filePath, [colSeparator], [useLocalHeader])`

## 6.11 ElmFeeder

- `CalcAggrVarsInRadFeed([lookForRoot], [considerNested])`
- `GetAll([iNested])`
- `GetBranches([iNested])`
- `GetBuses([iNested])`
- `GetNodesBranches([iNested])`
- `GetObjs(ClassName, [iNested])`

## 6.12 ElmFile

- `LoadFile([loadComplete=1])`
- `SaveFile()`

## 6.13 Grounding-related Methods

The following classes expose grounding impedance access methods:

- `ElmFilter.GetGroundingImpedance(busIdx)`
- `ElmGndswt.GetGroundingImpedance(busIdx)`
- `ElmNec.GetGroundingImpedance(busIdx)`
- `ElmShnt.GetGroundingImpedance(busIdx)`
- `ElmVac.GetGroundingImpedance(busIdx)`
- `ElmVoltreg.GetGroundingImpedance(busIdx)`
- `ElmXnet.GetGroundingImpedance(busIdx)`

Additional grounding switch methods:

- `ElmGndswt.Close()`
- `ElmGndswt.Open()`
- `ElmGndswt.IsClosed()`
- `ElmGndswt.IsOpen()`

Additional voltage regulator methods:

- `ElmVoltreg.CreateEvent([tapAction], [tapPos])`
- `ElmVoltreg.GetZpu(itappos, systembase)`
- `ElmVoltreg.NTap(tap)`

Additional external grid method:

- `ElmXnet.GetStepupTransformer(voltage, swStatus)`

## 6.14 Generator and PV-related Methods

### Common generation availability pattern

These classes expose generation-related convenience methods:

- `ElmGenstat`
- `ElmPvsys`
- `ElmSym`

Common methods:

- `Derate(deratingP)`
- `Disconnect()`
- `GetAvailableGenPower()`
- `GetGroundingImpedance(busIdx)`
- `IsConnected()` *(where applicable)*
- `Reconnect()`
- `ResetDerating()`

Additional synchronous machine methods:

- `ElmSym.GetMotorStartingFlag()`
- `ElmSym.GetStepupTransformer(voltage, swStatus)`

Additional static generator methods:

- `ElmGenstat.GetStepupTransformer(voltage, swStatus)`

## 6.15 ElmLne / ElmLnesec

### `ElmLne`

- `AreDistParamsPossible()`
- `CreateFeederWithRoutes(dis, rem, O, [sw0], [sw1])`
- `FitParams(isRMSModel, modify)`
- `GetIthr()`
- `GetType()`
- `GetY0m(Lne2)`
- `GetY1m(Lne2)`
- `GetZ0m(otherLine)`
- `GetZ1m(Lne2)`
- `GetZmatDist(frequency, exact, matrix)`
- `HasRoutes()`
- `HasRoutesOrSec()`
- `IsCable()`
- `IsNetCoupling()`
- `MeasureLength([iUseGraphic])`
- `SetDetailed()`

### `ElmLnesec`

- `IsCable()`

## 6.16 ElmNet / ElmZone

### `ElmNet`

- `Activate()`
- `Deactivate()`
- `CalculateInterchangeTo(net)`
- `DefineBoundary(shift)`

### `ElmZone`

- `CalculateInterchangeTo(zone)`
- `DefineBoundary(shift)`
- `GetAll()`
- `GetBranches()`
- `GetBuses()`
- `GetObjs(classname)`
- `SetLoadScaleAbsolute(Pin)`

## 6.17 ElmRelay

- `CheckRanges()`
- `GetCalcRX(inSec, unit)`
- `GetMaxFdetectCalcI(earth, unit)`
- `GetSlot(name, [iShowErr])`
- `GetUnom()`
- `IsStarted()`
- `SetImpedance(...)`
- `SetMaxI()`
- `SetMaxIearth()`
- `SetMinI()`
- `SetMinIearth()`
- `SetOutOfService(outServ, type, zone, unit)`
- `SetTime(time, type, zone, unit)`
- `SlotUpdate()`

## 6.18 ElmRes

This is the **core results object** for retrieval-heavy scripting.

### Configuration and variable registration

- `AddVariable(element, varname)`
- `SetObj(element)`
- `SetAsDefault()`
- `SetSubElmResKey(value)` / `SetSubElmResKey(obj)`

### Reading data

- `Load()`
- `Release()`
- `GetNumberOfColumns()`
- `GetNumberOfRows()`
- `FindColumn(obj, [varName])`
- `GetDescription([column], [short])`
- `GetUnit([column])`
- `GetVariable([column])`
- `GetObject([column])`
- `GetObj(index)`
- `GetValue(iX, [col])`
- `FindMaxInColumn(column)`
- `FindMinInColumn(column)`
- `FindMaxOfVariableInRow(variable, row)`
- `FindMinOfVariableInRow(variable, row)`
- `SortAccordingToColumn(column)`

### Iterating valid result entries

- `GetFirstValidObject(...)`
- `GetNextValidObject(...)`
- `GetFirstValidObjectVariable([variableNames])`
- `GetNextValidObjectVariable([variableNames])`
- `GetFirstValidVariable(row, [variableNames])`
- `GetNextValidVariable([variableNames])`

### Writing data

- `InitialiseWriting()`
- `InitialiseWriting(variableName, unit, description, [shortDescription])`
- `Write([defaultValue])`
- `WriteDraw()`
- `Flush()`
- `FinishWriting()`
- `Clear()`

### Reliability / nested result access

- `GetRelCase(caseNumber)`
- `GetSubElmRes(value)`
- `GetSubElmRes(obj)`

## 6.19 ElmStactrl

- `GetControlledHVNode(index)`
- `GetControlledLVNode(index)`
- `GetStepupTransformer([index], [iBrkMode])`
- `Info()`

## 6.20 ElmSubstat / ElmTrfstat

### Common split-related methods

- `GetSplit(index)`
- `GetSplitCal(index)`
- `GetSplitIndex(o)`
- `GetSuppliedElements([inclNested])`

### `ElmSubstat` additional methods

- `ApplyAndResetRA()`
- `OverwriteRA(ra)`
- `ResetRA()`
- `SaveAsRA(locname)`
- `SetRA(ra)`

## 6.21 ElmSvs

- `GetStepupTransformer(voltage, swStatus)`

## 6.22 ElmTerm

`ElmTerm` is one of the most important retrieval targets in PowerFactory scripting.

- `GetBusType()`
- `GetCalcRelevantCubicles()`
- `GetConnectedBrkCubicles([ignoreSwitchStates])`
- `GetConnectedCubicles([ignoreSwitchStates])`
- `GetConnectedMainBuses([considerSwitches])`
- `GetConnectionInfo()`
- `GetEquivalentTerminals()`
- `GetMinDistance(term)`
- `GetMinDistance(term, considerSwitches, [limitToNodes])`
- `GetNextHVBus()`
- `GetNodeName()`
- `GetSepStationAreas([considerSwitches])`
- `HasCreatedCalBus()`
- `IsElectrEquivalent(terminal, maxR, maxX)`
- `IsEquivalent(terminal)`
- `IsInternalNodeInSubStation()`
- `UpdateSubstationTerminals(volt, phs)`

## 6.23 ElmTr2 / ElmTr3 / ElmTr4

### Common transformer patterns

- `CreateEvent(...)`
- `GetGroundingImpedance(busIdx)`
- `GetSuppliedElements([inclNested])`
- `GetTapPhi(...)`
- `GetTapRatio(...)`
- `GetZ0pu(...)`
- `GetZpu(...)`
- `IsQuadBooster()`
- `NTap(...)`

### `ElmTr3` / `ElmTr4` additional

- `GetTapZDependentSide()`

---

## 7. Station Elements

## 7.1 StaCt

- `SetPrimaryTap([mltFactor])`

## 7.2 StaCubic

- `GetAll([direction=1], [ignoreOpenSwitches=0])`
- `GetBranch()`
- `GetConnectedMajorNodes([swtStat])`
- `GetConnections(swtStat)`
- `GetNearestBusbars(searchDirection)`
- `GetPathToNearestBusbar(nearestBusbar)`
- `IsClosed()`
- `IsConnected(elm, swtStat)`

## 7.3 External Measurement Classes

The extracted reference includes several `StaExt*` classes with a broadly similar pattern, including status handling, temporary status, measured value access, and transfer to controlled objects.

Covered in the extracted reference:

- `StaExtbrkmea`
- `StaExtcmdmea`
- `StaExtdatmea`

### Common method pattern

- `CopyExtMeaStatusToStatusTmp()`
- `GetMeaValue(...)`
- `GetStatus()`
- `GetStatusTmp()`
- `InitTmp()`
- `IsStatusBitSet(mask)`
- `IsStatusBitSetTmp(mask)`
- `ResetStatusBit(mask, dbSync)`
- `ResetStatusBitTmp(mask)`
- `SetMeaValue(value)`
- `SetStatus(status, dbSync)`
- `SetStatusBit(mask, dbSync)`
- `SetStatusBitTmp(mask)`
- `SetStatusTmp(status)`
- `UpdateControl(dbSync)`
- `UpdateCtrl(dbSync)`

### Status bitfield notes

The extracted documentation describes status fields as bitfields with flags including, among others:

- manually entered data
- tele-measurement
- disturbance
- protection
- marked suspect
- violated constraint
- on event
- event block
- alarm block
- update block
- control block
- read
- write
- neglected by SE

---

## 8. Common Python + PowerFactory Workflow Snippets

## 8.1 Start PowerFactory and get application

```python
import powerfactory
app = powerfactory.GetApplication()
```

## 8.2 Activate a project

```python
app.ActivateProject("MyProject")
```

## 8.3 Get calculation-relevant terminals

```python
terms = app.GetCalcRelevantObjects("*.ElmTerm")
```

## 8.4 Get active study case command object

```python
ldf = app.GetFromStudyCase("ComLdf")
```

## 8.5 Read results from an ElmRes object

```python
res = app.GetFromStudyCase("ElmRes")
res.Load()
rows = res.GetNumberOfRows()
cols = res.GetNumberOfColumns()
err, value = res.GetValue(0, 0)
res.Release()
```

## 8.6 Print to output window

```python
app.PrintInfo("Calculation started")
app.PrintWarn("Check model assumptions")
app.PrintError("Calculation failed")
```

## 8.7 Write to output window object directly

```python
out = app.GetOutputWindow()
out.Print(powerfactory.OutputWindow.MessageType.Plain, "Hello World")
```

---

## 9. Chatbot Retrieval Hints

### Best retrieval anchors

Use these exact tokens for high-precision retrieval:

- `powerfactory.GetApplication`
- `Application.GetCalcRelevantObjects`
- `Application.GetFromStudyCase`
- `Application.ActivateProject`
- `DataObject.GetAttribute`
- `DataObject.SetAttribute`
- `ElmRes.GetValue`
- `ElmRes.FindColumn`
- `ElmTerm.GetMinDistance`
- `ElmTerm.IsEquivalent`
- `ElmLne.MeasureLength`
- `ElmCoup.Open`
- `ElmCoup.Close`
- `ElmTr2.GetTapRatio`
- `ElmTr3.GetZpu`
- `ElmBoundary.IsSplitting`
- `StaCubic.GetNearestBusbars`

### Suggested intent mapping for a chatbot

| User intent | Retrieval anchors |
|---|---|
| Start PowerFactory from Python | `GetApplication`, `GetApplicationExt`, `Engine mode` |
| Open a project | `ActivateProject` |
| Get study case command | `GetFromStudyCase` |
| Read simulation/load-flow results | `ElmRes`, `GetValue`, `FindColumn`, `Load`, `Release` |
| Change attributes | `GetAttribute`, `SetAttribute`, `SetAttributeModeInternal` |
| Find elements in network | `GetCalcRelevantObjects`, `GetContents`, `SearchObject` |
| Work with switching | `SwitchOn`, `SwitchOff`, `Isolate`, `Energize`, `ElmCoup.Open`, `ElmCoup.Close` |
| Work with transformers | `ElmTr2`, `ElmTr3`, `ElmTr4`, `GetTapRatio`, `GetTapPhi`, `GetZpu` |
| Work with terminals/topology | `ElmTerm`, `GetEquivalentTerminals`, `GetMinDistance`, `GetNextHVBus` |
| Work with feeders/areas/zones | `ElmFeeder`, `ElmArea`, `ElmZone` |

---

## Notes and Limitations

1. This is a **retrieval-optimized condensed reference**, not a verbatim copy of the original PDF.
2. The original PDF contains a much larger class-by-class catalogue, including command classes, settings classes, and many additional object classes.
3. The uploaded extraction available during conversion was truncated in the later sections, so this Markdown emphasizes the sections that were successfully extracted and summarized.
4. For exact edge-case behavior, argument defaults, and complete class coverage, consult the original PDF when needed.

---

## Recommended System Prompt Reference Sentence

If you want to train a chatbot against this file, a good retrieval instruction is:

> “Use `DigSILENT PowerFactory Python API Reference (AI-Ready)` as the primary reference for PowerFactory Python scripting. Prefer exact class and method names from the reference before general Python assumptions.”

---

## End of Reference
