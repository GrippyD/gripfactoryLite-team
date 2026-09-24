# METRC Data Import templates (Michigan), captured 2026-09-02

Pulled by the Scribe from the owner's authenticated METRC session (mi.metrc.com, Data Import legacy page, license AU-G-C-000832), at the owner's direction: "use chrome while I'm signed into METRC and let's pull the data templates." Column lists are verbatim from the page; the header row line under each is the CSV's first line exactly as METRC's example shows it. Files are limited to 1 MB, plain text only, and every upload imports automatically and cannot be removed; uploads tie to the current account and facility.

Notable for Gripfactory: Harvest Plants is the wet weights lane we already ship (header match confirmed); Manicure Plants is the same shape plus PlantCount; Packages from Harvests is the trim-room lane; Package Adjustments covers post-hoc quantity fixes. There is NO transfer or manifest CSV import: manifests are created in the Transfers UI (Licensed Transfers / Templates), so the Interco "manifest csv" will be our own helper export shaped to that form, and "receiving a manifest" is likewise an in-UI acceptance our export supports.

## Plantings from Plants
Columns: Plant Label; Plant Batch Name; Plant Batch Type; Plant Count; Strain Name; Location Name; Sublocation Name; Patient License Number; Actual Date
Header: PlantLabel,PlantBatchName,PlantBatchType,PlantCount,StrainName,LocationName,SublocationName,PatientLicenseNumber,ActualDate

## Split Plant Batches
Columns: Plant Batch Name; Group Name; Plant Count; Location Name; Sublocation Name; Strain Name; Patient License Number; Actual Date
Header: PlantBatch,GroupName,Count,Location,Sublocation,Strain,PatientLicenseNumber,ActualDate

## Plantings from Packages
Columns: Package Label; Package Adjustment Amount; Package Adjustment Unit of Measure; Plant Batch Name; Plant Batch Type; Plant Count; Strain Name; Location Name; Sublocation Name; Patient License Number; Planted Date; Unpackaged Date
Header: PackageLabel,PackageAdjustmentAmount,PackageAdjustmentUnitOfMeasureName,PlantBatchName,PlantBatchType,PlantCount,StrainName,LocationName,SublocationName,PatientLicenseNumber,PlantedDate,UnpackagedDate

## Immature Plants Packages
Columns: Plant Batch Name; Item Name; Tag; Patient License Number; Note; Trade Sample; Donation; Plant Count; Location; Sublocation; Actual Date
Header: PlantBatch,Item,Tag,PatientLicenseNumber,Note,IsTradeSample,IsDonation,Count,Location,Sublocation,ActualDate

## Immature Plants Growth Phase
Columns: Plant Batch Name; Plant Count; Starting Tag; Growth Phase; New Location Name (optional); New Sublocation Name (optional); Growth Date; Patient License Number
Header: Name,Count,StartingTag,GrowthPhase,NewLocation,NewSublocation,GrowthDate,PatientLicenseNumber

## Destroy Immature Plants
Columns: Plant Batch Name; Plant Count; Waste Method; Material Mixed; Waste Reason; Reason Note; Waste Weight; Waste Unit Of Measure; Actual Date
Header: PlantBatch,Count,WasteMethodName,WasteMaterialMixed,WasteReasonName,ReasonNote,WasteWeight,WasteUnitOfMeasure,ActualDate

## Immature Plants Additives
Columns: Plant Batch Name; Additives Template Name; Rate; Volume; Total Amount (value); Total Amount (unit of measure); Date Applied
Header: PlantBatchName,AdditivesTemplateName,Rate,Volume,TotalAmountApplied,TotalAmountUnitOfMeasure,ActualDate

## Immature Plants Waste
Columns: Waste Method Name; Mixed Material; Waste Weight; Unit of Measure; Reason Name; Note; Waste Date; Plant Batch Name
Header: WasteMethodName,MixedMaterial,WasteWeight,UnitOfMeasureName,ReasonName,Note,WasteDate,PlantBatchName

## Adjust Plant Batch
Columns: PlantBatch Name; Adjustment Quantity; Adjustment Reason; Reason Note; Adjustment Date
Header: PlantBatchName,Quantity,AdjustmentReason,ReasonNote,AdjustmentDate

## Plants Location
Columns: Plant Label; Location Name; Sublocation Name; Actual Date
Header: Label,Location,Sublocation,ActualDate

## Plants Growth Phase
Columns: Plant Label; New Tag (optional); Growth Phase; New Location Name (optional); New Sublocation Name (optional); Growth Date
Header: Label,NewTag,GrowthPhase,NewLocation,NewSublocation,GrowthDate

## Destroy Plants
Columns: Plant Label; Waste Method Name; Waste Material Mixed; Waste Weight; Waste Unit Of Measure Name; Waste Reason Name; Reason Note; Actual Date
Header: Label,WasteMethodName,WasteMaterialMixed,WasteWeight,WasteUnitOfMeasureName,WasteReasonName,ReasonNote,ActualDate

## Manicure Plants
Columns: Plant Label; Harvested Weight; Unit of Weight; Drying Location Name; Drying Sublocation Name; Harvest Name; Patient License Number; Actual Date; Plant Count
Header: Plant,Weight,UnitOfWeight,DryingLocation,DryingSublocation,HarvestName,PatientLicenseNumber,ActualDate,PlantCount

## Harvest Plants (the wet weights lane, header matches our shipped CSV)
Columns: Plant Label; Harvested Weight; Unit of Weight; Drying Location Name; Drying Sublocation Name; Harvest Name; Patient License Number; Actual Date
Header: Plant,Weight,UnitOfWeight,DryingLocation,DryingSublocation,HarvestName,PatientLicenseNumber,ActualDate

## Plant Additives
Columns: Plant Tag; Additives Template Name; Rate; Volume; Total Amount (value); Total Amount (unit of measure); Date Applied
Header: PlantTag,AdditivesTemplateName,Rate,Volume,TotalAmountApplied,TotalAmountUnitOfMeasure,ActualDate

## Location Additives
Columns: Location Name; Sublocation Name; Additives Template Name; Rate; Volume; Total Amount (value); Total Amount (unit of measure); Date Applied
Header: LocationName,SublocationName,AdditivesTemplateName,Rate,Volume,TotalAmountApplied,TotalAmountUnitOfMeasure,ActualDate

## Plants Waste
Columns: Waste Method Name; Mixed Material; Waste Weight; Unit of Measure; Reason Name; Note; Location Name; Sublocation Name; Waste Date; Plant Labels
Header: WasteMethodName,MixedMaterial,WasteWeight,UnitOfMeasureName,ReasonName,Note,LocationName,SublocationName,WasteDate,PlantLabels
Note: multiple plant labels join with a pipe in the last column.

## Packages from Harvests (the trim-room lane)
Columns: Tag; Location Name; Sublocation Name; Item Name; Unit of Weight; Patient License Number; Note; Production Batch Number; Trade Sample; Donation; Actual Date; Harvest Name; Harvest Weight; Harvest Unit of Weight
Header: Tag,Location,Sublocation,Item,UnitOfWeight,PatientLicenseNumber,Note,ProductionBatchNumber,IsTradeSample,IsDonation,ActualDate,IngredientHarvestName,IngredientWeight,IngredientUnitOfWeight

## Package Adjustments
Columns: Package Label; Quantity; Unit of Measure; Adjustment Reason; Adjustment Note; Adjustment Date; Employee License Number
Header: Label,Quantity,UnitOfMeasure,AdjustmentReason,ReasonNote,AdjustmentDate,EmployeeLicenseNumber

## Open for the Interco slice
The outgoing manifest and the receiving acceptance have no CSV import lane; the Licensed Transfers form (destination license, planned route, transporter, driver and vehicle, departure and arrival, package tags) is the shape our helper exports must carry. The owner confirms the form's field list before the Interco build.
