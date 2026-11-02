const locationsQuery = `
SELECT LocationID,LocationName
FROM LocationMaster
WHERE ISNULL(LocationName,'')<>''
ORDER BY LocationName;`;

const orderFlowQuery = `
;WITH OrderHeader AS
(
    SELECT POH.SerialNumber POSerialNumber,SOH.SerialNumber SOSerialNumber,
           POH.SerialNumber OrderSerialNumber,'franchisee' OrderType,
           POH.VoucherDate PODate,SOH.DeliveryDate,SOH.LocationID,LM.LocationName,CM.CustomerName,
           CAST(NULL AS smallint) ToLocationID,CAST(NULL AS nvarchar(200)) ToLocationName,
           CAST(NULL AS smallint) FromWarehouseID,CAST(NULL AS nvarchar(200)) FromWarehouseName,
           CAST(NULL AS smallint) ToWarehouseID,CAST(NULL AS nvarchar(200)) ToWarehouseName,
           LTRIM(RTRIM(POH.VchIDPrefix+CASE WHEN LEN(POH.VchIDPrefix)>0 THEN '/' ELSE '' END+
             CASE WHEN POHV.PrefixVchIDYMD=57 THEN POH.VchIDYMD ELSE '' END+
             CASE WHEN LEN(POH.VchIDYMD)>0 AND POHV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
             CONVERT(varchar(20),POH.VchNumber))) PurchaseOrderVchNumber,
           LTRIM(RTRIM(ISNULL(SOH.VchIDPrefix,'')+CASE WHEN LEN(ISNULL(SOH.VchIDPrefix,''))>0 THEN '/' ELSE '' END+
             CASE WHEN SOHV.PrefixVchIDYMD=57 THEN ISNULL(SOH.VchIDYMD,'') ELSE '' END+
             CASE WHEN LEN(ISNULL(SOH.VchIDYMD,''))>0 AND SOHV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
             CONVERT(varchar(20),SOH.VchNumber))) SaleOrderVchNumber
    FROM PurchaseOrderHeader POH
    JOIN VoucherMaster POHV ON POHV.VoucherID=POH.VoucherID
    JOIN SaleOrderHeader SOH ON SOH.SerialNumber=POH.ConvertedSerialNumber AND SOH.IsDeleted=0
    JOIN VoucherMaster SOHV ON SOHV.VoucherID=SOH.VoucherID
    LEFT JOIN LocationMaster LM ON LM.LocationID=SOH.LocationID
    LEFT JOIN CustomerMaster CM ON CM.CustomerID=SOH.CustomerID
    WHERE POH.IsDeleted=0 AND POH.VoucherDate>=@FromDate AND POH.VoucherDate<DATEADD(day,1,@ToDate)

    UNION ALL

    SELECT NULL,SOH.SerialNumber,SOH.SerialNumber,'sales',SOH.VoucherDate,SOH.DeliveryDate,
           SOH.LocationID,LM.LocationName,CM.CustomerName,CAST(NULL AS smallint),CAST(NULL AS nvarchar(200)),
           CAST(NULL AS smallint),CAST(NULL AS nvarchar(200)),CAST(NULL AS smallint),CAST(NULL AS nvarchar(200)),'',
           LTRIM(RTRIM(SOH.VchIDPrefix+CASE WHEN LEN(SOH.VchIDPrefix)>0 THEN '/' ELSE '' END+
             CASE WHEN SOHV.PrefixVchIDYMD=57 THEN SOH.VchIDYMD ELSE '' END+
             CASE WHEN LEN(SOH.VchIDYMD)>0 AND SOHV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
             CONVERT(varchar(20),SOH.VchNumber)))
    FROM SaleOrderHeader SOH
    JOIN VoucherMaster SOHV ON SOHV.VoucherID=SOH.VoucherID
    LEFT JOIN LocationMaster LM ON LM.LocationID=SOH.LocationID
    LEFT JOIN CustomerMaster CM ON CM.CustomerID=SOH.CustomerID
    WHERE SOH.IsDeleted=0 AND SOH.VoucherDate>=@FromDate AND SOH.VoucherDate<DATEADD(day,1,@ToDate)
      AND NOT EXISTS(SELECT 1 FROM PurchaseOrderHeader POH WHERE POH.ConvertedSerialNumber=SOH.SerialNumber AND POH.IsDeleted=0)
), Ordered AS
(
    SELECT H.OrderSerialNumber,POD.ProductID,SUM(POD.Quantity) OrderedQuantity,SUM(POD.Quantity*RV.SelectedRate) OrderedAmount,
           SUM(POD.Quantity*RV.SelectedRate)/NULLIF(SUM(POD.Quantity),0) PurchaseRate
    FROM OrderHeader H JOIN PurchaseOrderDetail POD ON H.OrderType='franchisee' AND POD.SerialNumber=H.POSerialNumber AND POD.IsDeleted=0
    CROSS APPLY(SELECT CAST(CASE @RateType WHEN 'purchase_cost' THEN ISNULL(POD.PurchaseCost,0) WHEN 'sale_rate' THEN ISNULL(POD.SellingRate,0) ELSE ISNULL(POD.InputRate,0) END AS decimal(18,6)) SelectedRate) RV
    GROUP BY H.OrderSerialNumber,POD.ProductID
    UNION ALL
    SELECT H.OrderSerialNumber,SOD.ProductID,SUM(SOD.Quantity),SUM(SOD.Quantity*RV.SelectedRate),
           SUM(SOD.Quantity*RV.SelectedRate)/NULLIF(SUM(SOD.Quantity),0)
    FROM OrderHeader H JOIN SaleOrderDetail SOD ON H.OrderType='sales' AND SOD.SerialNumber=H.SOSerialNumber
    LEFT JOIN ProductChildMaster PCM ON PCM.ProductChildID=SOD.ProductChildID
    CROSS APPLY(SELECT CAST(CASE @RateType WHEN 'purchase_cost' THEN ISNULL(PCM.PurchaseCost,0) WHEN 'sale_rate' THEN ISNULL(SOD.SaleRate,0) ELSE ISNULL(PCM.PurchaseRate,0) END AS decimal(18,6)) SelectedRate) RV
    GROUP BY H.OrderSerialNumber,SOD.ProductID
), SCLink AS
(
    SELECT DISTINCT H.OrderSerialNumber,H.SOSerialNumber,SCD.SerialNumber SCSerialNumber,
           SCH.VoucherDate SCDate,SCH.LoadingNo,SCH.LoadingDate,
           LTRIM(RTRIM(SCH.VchIDPrefix+CASE WHEN LEN(SCH.VchIDPrefix)>0 THEN '/' ELSE '' END+
             CASE WHEN SCV.PrefixVchIDYMD=57 THEN SCH.VchIDYMD ELSE '' END+
             CASE WHEN LEN(SCH.VchIDYMD)>0 AND SCV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
             CONVERT(varchar(20),SCH.VchNumber))) SCMemoNumber
    FROM OrderHeader H
    JOIN SaleChallanDetail SCD ON SCD.SOSerialNumber=H.SOSerialNumber
    JOIN SaleChallanHeader SCH ON SCH.SerialNumber=SCD.SerialNumber AND SCH.VoucherDate>=H.PODate
    JOIN VoucherMaster SCV ON SCV.VoucherID=SCH.VoucherID
), Packed AS
(
    SELECT L.OrderSerialNumber,SCD.ProductID,COUNT(DISTINCT SCD.SerialNumber) PackedCartonCount,
           SUM(SCD.Quantity) PackedQuantity,SUM(ISNULL(SCD.FinalSaleAmount,0)) PackedAmount,MAX(L.SCDate) PackedDate
    FROM SCLink L JOIN SaleChallanDetail SCD ON SCD.SerialNumber=L.SCSerialNumber
    GROUP BY L.OrderSerialNumber,SCD.ProductID
), Despatched AS
(
    SELECT L.OrderSerialNumber,SCD.ProductID,COUNT(DISTINCT SCD.SerialNumber) DespatchedCartonCount,
           SUM(SCD.Quantity) DespatchedQuantity,SUM(ISNULL(SCD.FinalSaleAmount,0)) DespatchedAmount,MAX(L.LoadingDate) DespatchedDate
    FROM SCLink L JOIN SaleChallanDetail SCD ON SCD.SerialNumber=L.SCSerialNumber
    WHERE ISNULL(L.LoadingNo,0)<>0 OR ISNULL(L.LoadingDate,CONVERT(smalldatetime,'19000101'))>CONVERT(smalldatetime,'19000101')
    GROUP BY L.OrderSerialNumber,SCD.ProductID
), SILink AS
(
    SELECT DISTINCT H.OrderSerialNumber,SD.SerialNumber SISerialNumber,SH.VoucherDate SIDate,
           LTRIM(RTRIM(SH.VchIDPrefix+CASE WHEN LEN(SH.VchIDPrefix)>0 THEN '/' ELSE '' END+
             CASE WHEN SIV.PrefixVchIDYMD=57 THEN SH.VchIDYMD ELSE '' END+
             CASE WHEN LEN(SH.VchIDYMD)>0 AND SIV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
             CONVERT(varchar(20),SH.VchNumber))) SIMemoNumber
    FROM OrderHeader H JOIN SaleDetail SD ON SD.SOSerialNumber=H.SOSerialNumber
    JOIN SaleHeader SH ON SH.SerialNumber=SD.SerialNumber AND SH.VoucherDate>=H.PODate
    JOIN VoucherMaster SIV ON SIV.VoucherID=SH.VoucherID
    UNION
    SELECT DISTINCT L.OrderSerialNumber,SD.SerialNumber,SH.VoucherDate,
           LTRIM(RTRIM(SH.VchIDPrefix+CASE WHEN LEN(SH.VchIDPrefix)>0 THEN '/' ELSE '' END+
             CASE WHEN SIV.PrefixVchIDYMD=57 THEN SH.VchIDYMD ELSE '' END+
             CASE WHEN LEN(SH.VchIDYMD)>0 AND SIV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
             CONVERT(varchar(20),SH.VchNumber)))
    FROM SCLink L JOIN SaleDetail SD ON SD.SCSerialNumber=L.SCSerialNumber
    JOIN SaleHeader SH ON SH.SerialNumber=SD.SerialNumber AND SH.VoucherDate>=L.SCDate
    JOIN VoucherMaster SIV ON SIV.VoucherID=SH.VoucherID
), SCMemos AS
(
    SELECT X.OrderSerialNumber,STRING_AGG(X.SCMemoNumber,', ') PackedMemoNumbers
    FROM (SELECT DISTINCT OrderSerialNumber,SCMemoNumber FROM SCLink) X
    GROUP BY X.OrderSerialNumber
), LoadingMemos AS
(
    SELECT X.OrderSerialNumber,STRING_AGG(X.LoadingMemoNumber,', ') LoadingMemoNumbers
    FROM (SELECT DISTINCT OrderSerialNumber,CONVERT(varchar(50),CAST(LoadingNo AS decimal(18,4))) LoadingMemoNumber FROM SCLink WHERE ISNULL(LoadingNo,0)<>0) X
    GROUP BY X.OrderSerialNumber
), SIMemos AS
(
    SELECT X.OrderSerialNumber,STRING_AGG(X.SIMemoNumber,', ') BilledMemoNumbers
    FROM (SELECT DISTINCT OrderSerialNumber,SIMemoNumber FROM SILink) X
    GROUP BY X.OrderSerialNumber
), Billed AS
(
    SELECT L.OrderSerialNumber,SD.ProductID,COUNT(DISTINCT SD.SerialNumber) BilledVoucherCount,
           SUM(SD.Quantity) BilledQuantity,SUM(ISNULL(SD.FinalSaleAmount,0)) BilledAmount,MAX(L.SIDate) BilledDate
    FROM SILink L JOIN SaleDetail SD ON SD.SerialNumber=L.SISerialNumber
    GROUP BY L.OrderSerialNumber,SD.ProductID
), PILink AS
(
    SELECT DISTINCT L.OrderSerialNumber,PH.SerialNumber PISerialNumber,PH.VoucherDate PIDate
    FROM SILink L JOIN OrderHeader H ON H.OrderSerialNumber=L.OrderSerialNumber AND H.OrderType='franchisee'
    JOIN PurchaseHeader PH ON PH.ConvertedSerialNumber=L.SISerialNumber AND PH.IsDeleted=0 AND PH.VoucherDate>=L.SIDate
), Received AS
(
    SELECT L.OrderSerialNumber,PD.ProductID,COUNT(DISTINCT PD.SerialNumber) ReceivedVoucherCount,
           SUM(PD.Quantity) ReceivedQuantity,SUM(ISNULL(PD.ItemValue,0)) ReceivedAmount,MAX(L.PIDate) ReceivedDate
    FROM PILink L JOIN PurchaseDetail PD ON PD.SerialNumber=L.PISerialNumber AND PD.IsDeleted=0
    GROUP BY L.OrderSerialNumber,PD.ProductID
), Result AS
(
    SELECT H.*,O.ProductID,PM.ProductName,
           CAST(O.OrderedQuantity AS decimal(18,3)) OrderedQuantity,CAST(O.OrderedAmount AS decimal(18,3)) OrderedAmount,
           ISNULL(P.PackedCartonCount,0) PackedCartonCount,CAST(ISNULL(P.PackedQuantity,0) AS decimal(18,3)) PackedQuantity,
           CAST(ISNULL(P.PackedQuantity,0)*O.PurchaseRate AS decimal(18,3)) PackedAmount,
           ISNULL(D.DespatchedCartonCount,0) DespatchedCartonCount,CAST(ISNULL(D.DespatchedQuantity,0) AS decimal(18,3)) DespatchedQuantity,
           CAST(ISNULL(D.DespatchedQuantity,0)*O.PurchaseRate AS decimal(18,3)) DespatchedAmount,
           ISNULL(B.BilledVoucherCount,0) BilledVoucherCount,CAST(ISNULL(B.BilledQuantity,0) AS decimal(18,3)) BilledQuantity,
           CAST(ISNULL(B.BilledQuantity,0)*O.PurchaseRate AS decimal(18,3)) BilledAmount,
           ISNULL(R.ReceivedVoucherCount,0) ReceivedVoucherCount,CAST(ISNULL(R.ReceivedQuantity,0) AS decimal(18,3)) ReceivedQuantity,
           CAST(ISNULL(R.ReceivedQuantity,0)*O.PurchaseRate AS decimal(18,3)) ReceivedAmount,
           P.PackedDate,B.BilledDate,D.DespatchedDate,R.ReceivedDate,
           SCM.PackedMemoNumbers,SIM.BilledMemoNumbers,LM.LoadingMemoNumbers,
           CAST(O.OrderedQuantity-CASE
             WHEN H.OrderType='sales' AND EXISTS(SELECT 1 FROM SCLink X WHERE X.OrderSerialNumber=H.OrderSerialNumber) THEN ISNULL(D.DespatchedQuantity,0)
             WHEN H.OrderType='sales' THEN ISNULL(B.BilledQuantity,0)
             ELSE ISNULL(R.ReceivedQuantity,0) END AS decimal(18,3)) PendingQuantity,
           CAST(O.OrderedAmount-CASE
             WHEN H.OrderType='sales' AND EXISTS(SELECT 1 FROM SCLink X WHERE X.OrderSerialNumber=H.OrderSerialNumber) THEN ISNULL(D.DespatchedQuantity,0)*O.PurchaseRate
             WHEN H.OrderType='sales' THEN ISNULL(B.BilledQuantity,0)*O.PurchaseRate
             ELSE ISNULL(R.ReceivedQuantity,0)*O.PurchaseRate END AS decimal(18,3)) PendingAmount,
           CASE WHEN CASE
             WHEN H.OrderType='sales' AND EXISTS(SELECT 1 FROM SCLink X WHERE X.OrderSerialNumber=H.OrderSerialNumber) THEN ISNULL(D.DespatchedQuantity,0)
             WHEN H.OrderType='sales' THEN ISNULL(B.BilledQuantity,0)
             ELSE ISNULL(R.ReceivedQuantity,0) END>=O.OrderedQuantity THEN 'Closed' ELSE 'Pending' END ItemStatus
    FROM OrderHeader H JOIN Ordered O ON O.OrderSerialNumber=H.OrderSerialNumber
    JOIN ProductMaster PM ON PM.ProductID=O.ProductID
    LEFT JOIN Packed P ON P.OrderSerialNumber=O.OrderSerialNumber AND P.ProductID=O.ProductID
    LEFT JOIN Despatched D ON D.OrderSerialNumber=O.OrderSerialNumber AND D.ProductID=O.ProductID
    LEFT JOIN Billed B ON B.OrderSerialNumber=O.OrderSerialNumber AND B.ProductID=O.ProductID
    LEFT JOIN Received R ON R.OrderSerialNumber=O.OrderSerialNumber AND R.ProductID=O.ProductID
    LEFT JOIN SCMemos SCM ON SCM.OrderSerialNumber=O.OrderSerialNumber
    LEFT JOIN SIMemos SIM ON SIM.OrderSerialNumber=O.OrderSerialNumber
    LEFT JOIN LoadingMemos LM ON LM.OrderSerialNumber=O.OrderSerialNumber
), TransferResult AS
(
    SELECT CAST(NULL AS decimal(18,4)) POSerialNumber,CAST(NULL AS decimal(18,4)) SOSerialNumber,
           H.SerialNumber OrderSerialNumber,'transfers' OrderType,H.VoucherDate PODate,H.DeliveryDate,
           H.FromLocationID LocationID,FL.LocationName,CAST(NULL AS nvarchar(200)) CustomerName,H.ToLocationID,TL.LocationName ToLocationName,
           H.FromWarehouseID,FW.WarehouseName FromWarehouseName,H.ToWarehouseID,TW.WarehouseName ToWarehouseName,
           LTRIM(RTRIM(H.VchIDPrefix+CASE WHEN LEN(H.VchIDPrefix)>0 THEN '/' ELSE '' END+
             CASE WHEN VM.PrefixVchIDYMD=57 THEN H.VchIDYMD ELSE '' END+
             CASE WHEN LEN(H.VchIDYMD)>0 AND VM.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
             CONVERT(varchar(20),H.VchNumber))) PurchaseOrderVchNumber,
           CAST('' AS nvarchar(100)) SaleOrderVchNumber,
           D.ProductID,PM.ProductName,
           CAST(D.Quantity AS decimal(18,3)) OrderedQuantity,CAST(D.Quantity*RV.SelectedRate AS decimal(18,3)) OrderedAmount,
           0 PackedCartonCount,CAST(0 AS decimal(18,3)) PackedQuantity,CAST(0 AS decimal(18,3)) PackedAmount,
           0 DespatchedCartonCount,CAST(ISNULL(D.TrCh,0) AS decimal(18,3)) DespatchedQuantity,
           CAST(ISNULL(D.TrCh,0)*RV.SelectedRate AS decimal(18,3)) DespatchedAmount,
           0 BilledVoucherCount,CAST(0 AS decimal(18,3)) BilledQuantity,CAST(0 AS decimal(18,3)) BilledAmount,
           0 ReceivedVoucherCount,CAST(0 AS decimal(18,3)) ReceivedQuantity,CAST(0 AS decimal(18,3)) ReceivedAmount,
           CAST(NULL AS smalldatetime) PackedDate,CAST(NULL AS smalldatetime) BilledDate,TX.TransferDate DespatchedDate,CAST(NULL AS smalldatetime) ReceivedDate,
           CAST(NULL AS nvarchar(max)) PackedMemoNumbers,CAST(NULL AS nvarchar(max)) BilledMemoNumbers,TX.TransferMemoNumbers LoadingMemoNumbers,
           CAST(ISNULL(D.Bal,D.Quantity-ISNULL(D.TrCh,0)-ISNULL(D.Adj,0)) AS decimal(18,3)) PendingQuantity,
           CAST(ISNULL(D.Bal,D.Quantity-ISNULL(D.TrCh,0)-ISNULL(D.Adj,0))*RV.SelectedRate AS decimal(18,3)) PendingAmount,
           CASE WHEN ISNULL(D.Bal,D.Quantity-ISNULL(D.TrCh,0)-ISNULL(D.Adj,0))<=0 THEN 'Closed' ELSE 'Pending' END ItemStatus
    FROM StockTransferOrderHeader H
    JOIN VoucherMaster VM ON VM.VoucherID=H.VoucherID
    JOIN StockTransferOrderDetail D ON D.SerialNumber=H.SerialNumber
    LEFT JOIN ProductChildMaster PCM ON PCM.ProductChildID=D.ProductChildID
    CROSS APPLY(SELECT CAST(CASE @RateType WHEN 'purchase_cost' THEN ISNULL(D.PurchaseCost,0) WHEN 'sale_rate' THEN ISNULL(D.SaleRate,0) ELSE ISNULL(PCM.PurchaseRate,D.PurchaseCost) END AS decimal(18,6)) SelectedRate) RV
    JOIN ProductMaster PM ON PM.ProductID=D.ProductID
    LEFT JOIN LocationMaster FL ON FL.LocationID=H.FromLocationID
    LEFT JOIN LocationMaster TL ON TL.LocationID=H.ToLocationID
    LEFT JOIN WarehouseMaster FW ON FW.WarehouseID=H.FromWarehouseID
    LEFT JOIN WarehouseMaster TW ON TW.WarehouseID=H.ToWarehouseID
    OUTER APPLY(
      SELECT MAX(X.VoucherDate) TransferDate,STRING_AGG(X.TransferMemoNumber,', ') TransferMemoNumbers
      FROM (
        SELECT DISTINCT STH.SerialNumber,STH.VoucherDate,
          LTRIM(RTRIM(STH.VchIDPrefix+CASE WHEN LEN(STH.VchIDPrefix)>0 THEN '/' ELSE '' END+
            CASE WHEN STV.PrefixVchIDYMD=57 THEN STH.VchIDYMD ELSE '' END+
            CASE WHEN LEN(STH.VchIDYMD)>0 AND STV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
            CONVERT(varchar(20),STH.VchNumber))) TransferMemoNumber
        FROM StockTransferDetail STD
        JOIN StockTransferHeader STH ON STH.SerialNumber=STD.SerialNumber
        JOIN VoucherMaster STV ON STV.VoucherID=STH.VoucherID
        WHERE STD.TOSerialNumber=H.SerialNumber AND STD.ProductID=D.ProductID
      ) X
    ) TX
    WHERE H.VoucherDate>=@FromDate AND H.VoucherDate<DATEADD(day,1,@ToDate)
)
SELECT R.*,CASE WHEN MIN(CASE WHEN ItemStatus='Closed' THEN 1 ELSE 0 END) OVER(PARTITION BY OrderSerialNumber)=1 THEN 'Closed' ELSE 'Pending' END OrderStatus
FROM Result R
UNION ALL
SELECT T.*,CASE WHEN MIN(CASE WHEN ItemStatus='Closed' THEN 1 ELSE 0 END) OVER(PARTITION BY OrderSerialNumber)=1 THEN 'Closed' ELSE 'Pending' END OrderStatus
FROM TransferResult T
ORDER BY PODate DESC,OrderSerialNumber DESC,ProductName;`;

const cartonsQuery = `
SELECT DISTINCT SCH.SerialNumber SCSerialNumber,SCD.SOSerialNumber,
       CASE WHEN PO.POSerialNumber IS NULL THEN SCD.SOSerialNumber ELSE PO.POSerialNumber END OrderSerialNumber,
       CASE WHEN PO.POSerialNumber IS NULL THEN 'sales' ELSE 'franchisee' END OrderType,
       SOH.LocationID,LM.LocationName,
       LTRIM(RTRIM(SCH.VchIDPrefix+CASE WHEN LEN(SCH.VchIDPrefix)>0 THEN '/' ELSE '' END+
         CASE WHEN VM.PrefixVchIDYMD=57 THEN SCH.VchIDYMD ELSE '' END+
         CASE WHEN LEN(SCH.VchIDYMD)>0 AND VM.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
         CONVERT(varchar(20),SCH.VchNumber))) CartonNumber,
       SCH.VoucherDate PackingDate,CM.CustomerName,SCH.UDFField10 GrossWeight,
       SCH.LoadingNo,SCH.LoadingDate,SCH.VehicleNo,UM.UserName DriverName,
       SI.SISerialNumber,SI.BillingDate,SI.BillingNumber,
       CASE WHEN ISNULL(SCH.LoadingNo,0)<>0 OR ISNULL(SCH.LoadingDate,CONVERT(smalldatetime,'19000101'))>CONVERT(smalldatetime,'19000101') THEN 'Loaded' ELSE 'Awaiting loading' END LoadingStatus
FROM SaleChallanHeader SCH
JOIN VoucherMaster VM ON VM.VoucherID=SCH.VoucherID
CROSS APPLY(SELECT TOP(1) X.SOSerialNumber FROM SaleChallanDetail X WHERE X.SerialNumber=SCH.SerialNumber AND ISNULL(X.SOSerialNumber,0)<>0) SCD
JOIN SaleOrderHeader SOH ON SOH.SerialNumber=SCD.SOSerialNumber
OUTER APPLY(SELECT TOP(1) P.SerialNumber POSerialNumber FROM PurchaseOrderHeader P WHERE P.ConvertedSerialNumber=SCD.SOSerialNumber AND P.IsDeleted=0) PO
OUTER APPLY(
  SELECT TOP(1) SD.SerialNumber SISerialNumber,SH.VoucherDate BillingDate,
    LTRIM(RTRIM(SH.VchIDPrefix+CASE WHEN LEN(SH.VchIDPrefix)>0 THEN '/' ELSE '' END+
      CASE WHEN SIV.PrefixVchIDYMD=57 THEN SH.VchIDYMD ELSE '' END+
      CASE WHEN LEN(SH.VchIDYMD)>0 AND SIV.PrefixVchIDYMD=57 THEN '/' ELSE '' END+
      CONVERT(varchar(20),SH.VchNumber))) BillingNumber
  FROM SaleDetail SD
  JOIN SaleHeader SH ON SH.SerialNumber=SD.SerialNumber
  JOIN VoucherMaster SIV ON SIV.VoucherID=SH.VoucherID
  WHERE SD.SCSerialNumber=SCH.SerialNumber
  ORDER BY SH.VoucherDate DESC,SD.SerialNumber DESC
) SI
LEFT JOIN CustomerMaster CM ON CM.CustomerID=SCH.CustomerID
LEFT JOIN LocationMaster LM ON LM.LocationID=SOH.LocationID
LEFT JOIN UserMaster UM ON UM.UserID=SCH.DriverID
WHERE SCH.VoucherDate>=@FromDate AND SCH.VoucherDate<DATEADD(day,1,@ToDate)
ORDER BY SCH.VoucherDate DESC,CartonNumber;`;

const cartonItemsQuery = `
SELECT SCD.SerialNumber SCSerialNumber,SCD.ProductID,PM.ProductName,
       SUM(SCD.Quantity) Quantity,SUM(ISNULL(SCD.FinalSaleAmount,0)) Amount
FROM SaleChallanDetail SCD
LEFT JOIN ProductMaster PM ON PM.ProductID=SCD.ProductID
WHERE SCD.SerialNumber=@SerialNumber
GROUP BY SCD.SerialNumber,SCD.ProductID,PM.ProductName
ORDER BY PM.ProductName,SCD.ProductID;`;

module.exports = {
  locationsQuery,
  orderFlowQuery,
  cartonsQuery,
  cartonItemsQuery,
};
