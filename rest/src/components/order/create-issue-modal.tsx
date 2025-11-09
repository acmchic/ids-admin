import React, { useState, useEffect } from "react";
import Modal from "@components/ui/modal/modal";
import { toast } from "react-toastify";
import axios from "axios";
import { ClipboardList } from "lucide-react";

const ISSUE_API_BASE = process.env.NEXT_PUBLIC_REST_API_ENDPOINT

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onIssueCreated?: () => void;
}

const ISSUE_TYPES = [
  { value: "new", label: "New" },
  { value: "change_shipping_address", label: "Đổi Shipping address" },
  { value: "change_variation", label: "Change Size / Màu / Vị trí" },
  { value: "replace", label: "Replace" },
  { value: "merge_order", label: "Gộp Đơn" },
];

const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  onClose,
  order,
  onIssueCreated,
}) => {
  const [issueType, setIssueType] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // JSON Editor for all types
  const [jsonData, setJsonData] = useState("");
  const [jsonError, setJsonError] = useState("");
  
  // For variation - need to track which product
  const [selectedProductId, setSelectedProductId] = useState("");

  // Replace - selected fulfillment method
  const [replaceFulfillMethod, setReplaceFulfillMethod] = useState("");

  // Merge - target order to merge with
  const [targetOrderNumber, setTargetOrderNumber] = useState("");
  const [mergeValidation, setMergeValidation] = useState<any>(null);
  const [mergeableOrders, setMergeableOrders] = useState<any[]>([]);
  const [loadingMergeableOrders, setLoadingMergeableOrders] = useState(false);

  const [notes, setNotes] = useState("");

  // Existing issues for this order
  const [existingIssues, setExistingIssues] = useState<any[]>([]);
  const [openIssue, setOpenIssue] = useState<any>(null);

  // Load order details and existing issues when modal opens
  useEffect(() => {
    if (isOpen && order) {
      loadOrderDetails();
      loadExistingIssues();
    }
  }, [isOpen, order]);

  // Load mergeable orders when issue type is merge_order
  useEffect(() => {
    if (issueType === "merge_order" && order) {
      loadMergeableOrders();
    }
  }, [issueType, order]);

  // Auto-select product if only 1 product
  useEffect(() => {
    if (issueType === "change_variation" && orderDetails?.order_product) {
      const products = orderDetails.order_product;
      if (products.length === 1 && !selectedProductId) {
        setSelectedProductId(products[0].id);
      }
    }
  }, [issueType, orderDetails]);

  // Load JSON data when issue type or order details change
  useEffect(() => {
    if (!orderDetails) return;
    
    setJsonError("");
    
    if (issueType === "change_shipping_address" && orderDetails.shipping_address) {
      setJsonData(JSON.stringify(orderDetails.shipping_address, null, 2));
    } else if (issueType === "change_variation" && selectedProductId) {
      const product = orderDetails.order_product?.find((p: any) => p.id === selectedProductId);
      if (product && product.variation) {
        // Only show name, size, color, side
        const simplifiedVariation = {
          name: product.variation.name || "",
          size: product.variation.size || "",
          color: product.variation.color || "",
          side: product.variation.side || ""
        };
        setJsonData(JSON.stringify(simplifiedVariation, null, 2));
      }
    } else {
      setJsonData("");
    }
  }, [issueType, orderDetails, selectedProductId]);

  const loadOrderDetails = async () => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`${ISSUE_API_BASE}/api/orders/get-order-details-simple?order_id=${order.id}`);
      const data = await response.json();
      console.log("data ==> ", data);
      
      if (data.success) {
        setOrderDetails(data.order);
      } else {
        toast.error(data.error || "Không thể tải thông tin đơn hàng");
        console.error("API Error:", data);
      }
    } catch (error) {
      console.error("Error loading order details:", error);
      toast.error("Không thể tải thông tin đơn hàng");
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadExistingIssues = async () => {
    try {
      if (!order?.id || !ISSUE_API_BASE) return;
      const response = await fetch(`${ISSUE_API_BASE}/issues/order/${order.id}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setExistingIssues(data.issues || []);
        
        // Find open issue
        const open = data.issues?.find((issue: any) => issue.status === 'open');
        if (open) {
          setOpenIssue(open);
          // Auto-fill form with open issue data
          setIssueType(open.issue_type);
          setNotes(open.notes || "");
          
          // Load old_data into JSON editor if available
          if (open.old_data) {
            setJsonData(JSON.stringify(open.old_data, null, 2));
          }
        }
      } else if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Error loading existing issues:", error);
    }
  };

  const loadMergeableOrders = async () => {
    setLoadingMergeableOrders(true);
    try {
      if (!ISSUE_API_BASE) {
        throw new Error("Issue API chưa được cấu hình");
      }
      const response = await fetch(`${ISSUE_API_BASE}/api/orders/get-mergeable-orders?order_id=${order.id}`);
      const data = await response.json();
      
      if (data.success) {
        setMergeableOrders(data.orders || []);
      } else {
        toast.error("Không thể tải danh sách đơn hàng có thể gộp");
      }
    } catch (error) {
      console.error("Error loading mergeable orders:", error);
      toast.error("Không thể tải danh sách đơn hàng có thể gộp");
    } finally {
      setLoadingMergeableOrders(false);
    }
  };

  const handleJsonChange = (value: string) => {
    setJsonData(value);
    setJsonError("");
    
    // Try to validate JSON on change
    if (value.trim()) {
      try {
        JSON.parse(value);
      } catch (e: any) {
        setJsonError(e.message);
      }
    }
  };

  // Create issue only (status = open)
  const handleCreate = async () => {
    if (!issueType) {
      toast.error("Vui lòng chọn Issue");
      return;
    }

    if (!ISSUE_API_BASE) {
      toast.error("Issue API chưa được cấu hình");
      return;
    }

    setLoading(true);

    try {
      // For "New" type, just create issue without any updates
      if (issueType === "new") {
        const issueResponse = await fetch(`${ISSUE_API_BASE}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            issue_type: issueType,
            status: "open",
            old_data: null,
            new_data: null,
            notes: notes,
            created_by: "admin",
          }),
        });

        const issueResult = await issueResponse.json().catch(() => null);

        if (!issueResponse.ok || !issueResult?.success) {
          const message =
            issueResult?.error ||
            issueResult?.message ||
            (issueResult?.errors ? JSON.stringify(issueResult.errors) : undefined) ||
            `HTTP ${issueResponse.status}: Failed to create issue`;
          throw new Error(message);
        }

        toast.success("Đã  Create Ticket thành công!");
        if (onIssueCreated) onIssueCreated();
        handleClose();
        setLoading(false);
        return;
      }

      // For other types, create issue but don't resolve yet
      const issueResponse = await fetch(`${ISSUE_API_BASE}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          issue_type: issueType,
          status: "open",
          old_data: null,
          new_data: null,
          notes: notes,
          created_by: "admin",
        }),
      });

      const issueResult = await issueResponse.json().catch(() => null);

      if (!issueResponse.ok || !issueResult?.success) {
        const message =
          issueResult?.error ||
          issueResult?.message ||
          (issueResult?.errors ? JSON.stringify(issueResult.errors) : undefined) ||
          `HTTP ${issueResponse.status}: Failed to create issue`;
        throw new Error(message);
      }

      toast.success("Đã  Create Ticket thành công!");
      if (onIssueCreated) onIssueCreated();
      handleClose();
    } catch (error: any) {
      console.error("Error creating issue:", error);
      toast.error(error.message || "Không thể  Create Ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleResolveNew = async () => {
    if (!ISSUE_API_BASE) {
      toast.error("Issue API chưa được cấu hình");
      return;
    }

    if (!openIssue || openIssue.issue_type !== "new") {
      toast.error("Không có ticket 'New' nào cần xử lý");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${ISSUE_API_BASE}/issues/${openIssue.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "resolved",
          notes,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        const message =
          result?.error ||
          result?.message ||
          (result?.errors ? JSON.stringify(result.errors) : undefined) ||
          `HTTP ${response.status}: Failed to update issue`;
        throw new Error(message);
      }

      toast.success("Đã Xử lý thành công!");
      if (onIssueCreated) {
        onIssueCreated();
      }
      handleClose();
    } catch (error: any) {
      console.error("Error resolving new issue:", error);
      toast.error(error.message || "Không thể Xử lý");
    } finally {
      setLoading(false);
    }
  };

  // Resolve issue (update data + change status to resolved)
  const handleResolve = async () => {
    if (!issueType) {
      toast.error("Vui lòng chọn Issue");
      return;
    }

    if (!ISSUE_API_BASE) {
      toast.error("Issue API chưa được cấu hình");
      return;
    }

    if (issueType === "new") {
      toast.error('Loại "Mới" chỉ có thể tạo, không thể giải quyết');
      return;
    }

    setLoading(true);

    try {
      let oldData = null;
      let newData = null;

      // Handle different issue types
      if (issueType === "change_shipping_address") {
        // Parse and validate JSON
        if (!jsonData.trim()) {
          toast.error("Vui lòng nhập dữ liệu địa chỉ giao hàng");
          setLoading(false);
          return;
        }

        let parsedData;
        try {
          parsedData = JSON.parse(jsonData);
        } catch (e) {
          toast.error("Định dạng JSON không hợp lệ");
          setLoading(false);
          return;
        }

        // Basic validation
        if (!parsedData.shipping_name || !parsedData.shipping_address1 || 
            !parsedData.shipping_city || !parsedData.shipping_zipcode) {
          toast.error("Thiếu các trường bắt buộc: tên, địa chỉ, thành phố, mã zip");
          setLoading(false);
          return;
        }

        oldData = orderDetails?.shipping_address || null;
        newData = parsedData;

        // Update shipping address
        const updateResponse = await fetch(`${ISSUE_API_BASE}/api/orders/update-shipping-address`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            shipping_address: parsedData,
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({ error: "HTTP error" }));
          throw new Error(errorData.error || `HTTP ${updateResponse.status}: Failed to update shipping address`);
        }

        const updateResult = await updateResponse.json();
        if (!updateResult.success) {
          throw new Error(updateResult.error || "Failed to update shipping address");
        }
      } else if (issueType === "change_variation") {
        if (!selectedProductId) {
          toast.error("Vui lòng chọn sản phẩm");
          setLoading(false);
          return;
        }

        // Parse and validate JSON
        if (!jsonData.trim()) {
          toast.error("Vui lòng nhập dữ liệu biến thể");
          setLoading(false);
          return;
        }

        let parsedData;
        try {
          parsedData = JSON.parse(jsonData);
        } catch (e) {
          toast.error("Định dạng JSON không hợp lệ");
          setLoading(false);
          return;
        }

        // Find selected product
        const selectedProduct = orderDetails?.order_product?.find(
          (p: any) => p.id === selectedProductId
        );

        if (!selectedProduct) {
          toast.error("Không tìm thấy sản phẩm");
          setLoading(false);
          return;
        }

        oldData = selectedProduct.variation || null;
        newData = parsedData;

        // Update variation - need to merge with existing variation data
        const existingVariation = selectedProduct.variation || {};
        const mergedVariation = {
          ...existingVariation,
          ...parsedData, // Override with new values
        };

        const updateResponse = await fetch(`${ISSUE_API_BASE}/api/orders/update-variation`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_product_id: selectedProductId,
            variation: mergedVariation,
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({ error: "HTTP error" }));
          throw new Error(errorData.error || `HTTP ${updateResponse.status}: Failed to update variation`);
        }

        const updateResult = await updateResponse.json();
        if (!updateResult.success) {
          throw new Error(updateResult.error || "Failed to update variation");
        }
      } else if (issueType === "replace") {
        if (!replaceFulfillMethod) {
          toast.error("Vui lòng chọn phương thức fulfill");
          setLoading(false);
          return;
        }

        // Map fulfillment method to status
        const statusMap: Record<string, number> = {
          merchize: 2,
          mango: 69,
          burger: 9,
          fulfil: 8,
        };

        const newStatus = statusMap[replaceFulfillMethod];

        // Update order status via external API (same as fulfill buttons)
        try {
          await axios.put(`https://orders.idreamshirt.com/orders/${order.id}`, {
            status: newStatus,
          });

          // Update email_send to 0
          const emailResponse = await fetch(`${ISSUE_API_BASE}/api/orders/update-email-sent`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: order.id,
              email_send: 0,
            }),
          });

          const emailResult = await emailResponse.json();
          if (!emailResult.success) {
            throw new Error("Failed to update email_send");
          }

          oldData = { status: order.status?.id, email_send: order.email_send };
          newData = { status: newStatus, email_send: 0, method: replaceFulfillMethod };
        } catch (error: any) {
          throw new Error(error?.response?.data?.message || error?.message || "Failed to fulfill order");
        }
      } else if (issueType === "merge_order") {
        if (!targetOrderNumber.trim()) {
          toast.error("Vui lòng chọn đơn hàng để gộp");
          setLoading(false);
          return;
        }

        if (!mergeValidation || !mergeValidation.canMerge) {
          toast.error("Vui lòng kiểm tra khả năng gộp đơn trước");
          setLoading(false);
          return;
        }

        // Merge orders
        const mergeResponse = await fetch(`${ISSUE_API_BASE}/api/orders/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id_from: targetOrderNumber,
            order_id_to: order.id,
          }),
        });

        if (!mergeResponse.ok) {
          const errorData = await mergeResponse.json().catch(() => ({ error: "HTTP error" }));
          throw new Error(errorData.error || `HTTP ${mergeResponse.status}: Failed to merge orders`);
        }

        const mergeResult = await mergeResponse.json();
        if (!mergeResult.success) {
          throw new Error(mergeResult.error || "Failed to merge orders");
        }

        oldData = {
          order1: order.id,
          order2: targetOrderNumber,
          total1: mergeValidation.order1?.total,
          total2: mergeValidation.order2?.total,
        };
        newData = {
          mergedOrderId: order.id,
          newTotal: mergeResult.newTotal,
        };
      }

      // If there's an existing open issue, update it; otherwise create new one
      if (openIssue) {
        // Update existing issue to resolved
        const updateResponse = await fetch(`${ISSUE_API_BASE}/issues/${openIssue.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "resolved",
            new_data: newData,
            notes: notes,
          }),
        });

        const updateResult = await updateResponse.json().catch(() => null);
        if (!updateResponse.ok || !updateResult?.success) {
          const message =
            updateResult?.error ||
            updateResult?.message ||
            (updateResult?.errors ? JSON.stringify(updateResult.errors) : undefined) ||
            `HTTP ${updateResponse.status}: Failed to update issue`;
          throw new Error(message);
        }
      } else {
        // Create new issue record with status = resolved
        const issueResponse = await fetch(`${ISSUE_API_BASE}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            issue_type: issueType,
            status: "resolved",
            old_data: oldData,
            new_data: newData,
            notes: notes,
            created_by: "admin",
          }),
        });

        const issueResult = await issueResponse.json().catch(() => null);
        if (!issueResponse.ok || !issueResult?.success) {
          const message =
            issueResult?.error ||
            issueResult?.message ||
            (issueResult?.errors ? JSON.stringify(issueResult.errors) : undefined) ||
            `HTTP ${issueResponse.status}: Failed to create issue`;
          throw new Error(message);
        }
      }

      toast.success("Đã Xử lý thành công!");
      
      if (onIssueCreated) {
        onIssueCreated();
      }
      
      handleClose();
    } catch (error: any) {
      console.error("Error creating issue:", error);
      toast.error(error.message || "Không thể Xử lý");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIssueType("");
    setNotes("");
    setJsonData("");
    setJsonError("");
    setSelectedProductId("");
    setReplaceFulfillMethod("");
    setTargetOrderNumber("");
    setMergeValidation(null);
    setMergeableOrders([]);
    setLoadingMergeableOrders(false);
    setExistingIssues([]);
    setOpenIssue(null);
    onClose();
  };

  const renderJsonEditor = (title: string) => (
    <div className="space-y-3">
      <h3 className="font-semibold text-md mb-3">{title}</h3>
      
      <div>
      
        <textarea
          value={jsonData}
          onChange={(e) => handleJsonChange(e.target.value)}
          rows={12}
          className={`w-full px-3 py-2 border rounded font-mono text-sm ${
            jsonError ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Dữ liệu JSON sẽ hiển thị ở đây..."
        />
        {jsonError && (
          <p className="text-red-500 text-xs mt-1">❌ JSON không hợp lệ: {jsonError}</p>
        )}
        {!jsonError && jsonData && (
          <p className="text-green-600 text-xs mt-1">✓ JSON hợp lệ</p>
        )}
      </div>
    </div>
  );

  const renderVariationForm = () => {
    if (!orderDetails?.order_product || orderDetails.order_product.length === 0) {
      return <div className="text-gray-500">Không tìm thấy sản phẩm cho đơn hàng này</div>;
    }

    const products = orderDetails.order_product;
    const hasMultipleProducts = products.length > 1;

    return (
      <div className="space-y-3">
        {hasMultipleProducts && (
          <div>
            <label className="block text-sm font-medium mb-2">Chọn Sản Phẩm *</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">-- Chọn Sản Phẩm --</option>
              {products.map((product: any) => (
                <option key={product.id} value={product.id}>
                  {product.variation?.name || `Sản phẩm #${product.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {!hasMultipleProducts && products.length === 1 && (
          <div className="p-2 bg-gray-50 rounded border">
            <p className="text-sm text-gray-600">
              <strong>Sản phẩm:</strong> {products[0].variation?.name || `Sản phẩm #${products[0].id}`}
            </p>
          </div>
        )}

        {selectedProductId && renderJsonEditor("Biến Thể Sản Phẩm (Tên, Size, Màu, Mặt)")}
      </div>
    );
  };

  const handleValidateMerge = async (orderId: string) => {
    if (!orderId) {
      toast.error("Vui lòng chọn đơn hàng để gộp");
      return;
    }

    setLoading(true);
    try {
      if (!ISSUE_API_BASE) {
        throw new Error("Issue API chưa được cấu hình");
      }
      const response = await fetch(`${ISSUE_API_BASE}/api/orders/validate-merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id_1: order.id,
          order_id_2: orderId,
        }),
      });

      const result = await response.json();
      setMergeValidation(result);

      if (!result.canMerge) {
        toast.error(result.reason || "Không thể gộp các đơn hàng này");
      } else {
        toast.success("Có thể gộp đơn hàng!");
      }
    } catch (error) {
      console.error("Error validating merge:", error);
      toast.error("Không thể kiểm tra khả năng gộp đơn");
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSelect = (orderId: string) => {
    setTargetOrderNumber(orderId);
    setMergeValidation(null);
    if (orderId) {
      handleValidateMerge(orderId);
    }
  };

  const renderMergeForm = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-md mb-3">Gộp Đơn Hàng</h3>
      
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
        <p className="font-medium text-blue-900 mb-1">Đơn Hàng Hiện Tại: #{order?.order_num || order?.id}</p>
        <p className="text-blue-700">Sản phẩm từ đơn hàng nguồn sẽ được chuyển vào đơn này</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Chọn Đơn Hàng Để Gộp * (Status = 1 + Cùng Địa Chỉ)
        </label>
        {loadingMergeableOrders ? (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Đang tải danh sách đơn hàng...</span>
          </div>
        ) : (
          <>
            <select
              value={targetOrderNumber}
              onChange={(e) => handleOrderSelect(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              disabled={loading || mergeableOrders.length === 0}
            >
              <option value="">-- Chọn Đơn Hàng --</option>
              {mergeableOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.order_num} - ${order.total} - {new Date(order.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            {mergeableOrders.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Không tìm thấy đơn hàng có thể gộp (phải có status = 1 và cùng địa chỉ giao hàng)
              </p>
            )}
          </>
        )}
      </div>

      {/* Validation Result */}
      {mergeValidation && (
        <div className={`p-4 rounded border-2 ${
          mergeValidation.canMerge 
            ? 'bg-green-50 border-green-500' 
            : 'bg-red-50 border-red-500'
        }`}>
          {mergeValidation.canMerge ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <h4 className="font-bold text-green-900">Có Thể Gộp Đơn Hàng</h4>
              </div>
              <div className="text-sm space-y-1">
                <p><strong>Email:</strong> {mergeValidation.order1?.email}</p>
                <p><strong>Đơn {mergeValidation.order1?.id} Tổng:</strong> ${mergeValidation.order1?.total}</p>
                <p><strong>Đơn {mergeValidation.order2?.id} Tổng:</strong> ${mergeValidation.order2?.total}</p>
                <p className="text-green-800 font-bold pt-2">
                  <strong>Tổng Mới Sau Khi Gộp:</strong> ${mergeValidation.newTotal}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">❌</span>
                <h4 className="font-bold text-red-900">Không Thể Gộp</h4>
              </div>
              <p className="text-sm text-red-800">{mergeValidation.reason}</p>
              {mergeValidation.field && (
                <div className="text-sm mt-2">
                  <p><strong>Trường:</strong> {mergeValidation.field}</p>
                  <p><strong>Đơn 1:</strong> {mergeValidation.value1}</p>
                  <p><strong>Đơn 2:</strong> {mergeValidation.value2}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderReplaceForm = () => (
    <div className="space-y-3">
      <h3 className="font-semibold text-md mb-3">Thay Thế Đơn Hàng - Chọn Phương Thức Fulfill</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setReplaceFulfillMethod("merchize")}
          className={`px-4 py-3 rounded border-2 transition-all ${
            replaceFulfillMethod === "merchize"
              ? "border-green-500 bg-green-50 text-green-700 font-semibold"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          Merchize
        </button>

        <button
          onClick={() => setReplaceFulfillMethod("mango")}
          className={`px-4 py-3 rounded border-2 transition-all ${
            replaceFulfillMethod === "mango"
              ? "border-orange-500 bg-orange-50 text-orange-700 font-semibold"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          Mango
        </button>

        <button
          onClick={() => setReplaceFulfillMethod("burger")}
          className={`px-4 py-3 rounded border-2 transition-all ${
            replaceFulfillMethod === "burger"
              ? "border-red-500 bg-red-50 text-red-700 font-semibold"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          Burger
        </button>

        <button
          onClick={() => setReplaceFulfillMethod("fulfil")}
          className={`px-4 py-3 rounded border-2 transition-all ${
            replaceFulfillMethod === "fulfil"
              ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          Fulfil
        </button>
      </div>

      {replaceFulfillMethod && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            Đơn hàng sẽ được fulfill qua <strong>{replaceFulfillMethod}</strong> và reset email_sent về 0
          </p>
        </div>
      )}
    </div>
  );

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <div className="bg-white rounded-lg shadow-xl w-[75vw] mx-auto">
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold"> Create Ticket</h2>
            <p className="text-sm text-gray-500">
              Đơn Hàng #{order?.order_num || order?.tracking_number || order?.id}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {loadingDetails ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Display Open Issue Info */}
              {openIssue && (
                <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-900 mb-2">Issues</h3>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Loại:</span>{" "}
                          <span className="text-yellow-800">
                            {ISSUE_TYPES.find(t => t.value === openIssue.issue_type)?.label || openIssue.issue_type}
                          </span>
                        </p>
                        {openIssue.notes && (
                          <p>
                            <span className="font-medium">Notes:</span>{" "}
                            <span className="text-yellow-800">{openIssue.notes}</span>
                          </p>
                        )}
                        
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Issue *</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  disabled={loading}
                >
                  <option value="">-- Chọn Issue --</option>
                  {ISSUE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {issueType === "change_shipping_address" && renderJsonEditor("Địa Chỉ Giao Hàng")}
              {issueType === "change_variation" && renderVariationForm()}
              {issueType === "replace" && renderReplaceForm()}
              {issueType === "merge_order" && renderMergeForm()}

              {issueType && (
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Note</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Thêm ghi chú nếu cần..."
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !issueType || loadingDetails}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {loading ? "Đang xử lý..." : " Create Ticket"}
          </button>

          {issueType === "new" && openIssue && (
            <button
              onClick={handleResolveNew}
              disabled={loading || loadingDetails}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {loading ? "Đang xử lý..." : "Đã xử lý"}
            </button>
          )}
          
          {issueType && issueType !== "new" && (
            <button
              onClick={handleResolve}
              disabled={
                loading || 
                !issueType || 
                loadingDetails || 
                (issueType === "merge_order" && (!mergeValidation || !mergeValidation.canMerge))
              }
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {loading ? "Đang xử lý..." : issueType === "merge_order" ? "Gộp Đơn Hàng" : "Xử lý"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CreateIssueModal;

