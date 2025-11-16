import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "react-toastify";
import Modal from "@components/ui/modal/modal";
import Button from "@components/ui/button";
import Input from "@components/ui/input";

interface AdsEntry {
  id: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

interface AdsData {
  entries: AdsEntry[];
  totalDebt: number;
}

interface AdsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AdsDialog({ open, onClose }: AdsDialogProps) {
  const [adsData, setAdsData] = useState<AdsData>({ entries: [], totalDebt: 0 });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDebt, setEditingDebt] = useState(false);
  
  // Form states
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [debtAmount, setDebtAmount] = useState("");

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadAdsData();
    }
  }, [open]);

  const loadAdsData = async () => {
    try {
      const response = await fetch("/api/ads");
      const data = await response.json();
      setAdsData(data);
      setDebtAmount(data.totalDebt.toString());
    } catch (error) {
      console.error("Failed to load ads data:", error);
      toast.error("Không thể tải dữ liệu");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !date) {
      toast.error("Vui lòng nhập đủ thông tin");
      return;
    }

    setLoading(true);
    
    try {
      const url = editingId ? "/api/ads" : "/api/ads";
      const method = editingId ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          amount: parseFloat(amount),
          date,
          note,
        }),
      });

      if (response.ok) {
        toast.success(editingId ? "Đã cập nhật" : "Đã thêm mới");
        setAmount("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setNote("");
        setEditingId(null);
        await loadAdsData();
      } else {
        toast.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: AdsEntry) => {
    setEditingId(entry.id);
    setAmount(entry.amount.toString());
    setDate(entry.date);
    setNote(entry.note || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setAmount("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setNote("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa?")) return;
    
    try {
      const response = await fetch(`/api/ads?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Đã xóa");
        await loadAdsData();
      } else {
        toast.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleUpdateDebt = async () => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalDebt: parseFloat(debtAmount || "0"),
        }),
      });

      if (response.ok) {
        toast.success("Đã cập nhật số tiền nợ");
        setEditingDebt(false);
        await loadAdsData();
      } else {
        toast.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.error("Failed to update debt:", error);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  // Calculate current month total
  const currentMonth = format(new Date(), "yyyy-MM");
  const monthlyTotal = adsData.entries
    .filter(entry => entry.date.startsWith(currentMonth))
    .reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Quản lý Chi phí Quảng cáo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Tổng tháng này</div>
            <div className="text-2xl font-bold text-blue-700">
              {monthlyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-red-600">Số tiền còn nợ</span>
              {!editingDebt && (
                <button
                  onClick={() => setEditingDebt(true)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Sửa
                </button>
              )}
            </div>
            {editingDebt ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="text-xl font-bold text-red-700 bg-white border border-red-300 rounded px-2 py-1 w-32"
                  step="0.01"
                />
                <button
                  onClick={handleUpdateDebt}
                  disabled={loading}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Lưu
                </button>
                <button
                  onClick={() => {
                    setEditingDebt(false);
                    setDebtAmount(adsData.totalDebt.toString());
                  }}
                  className="text-xs px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <div className="text-2xl font-bold text-red-700">
                {parseFloat(debtAmount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Form */}
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? "Chỉnh sửa" : "Thêm mới"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Input
              label="Money"
              name="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Input
              label="Ngày nạp"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="Ghi chú"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
            >
              {editingId ? "Cập nhật" : "Thêm"}
            </Button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Hủy
              </button>
            )}
          </div>
        </form>

        {/* Entries List */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Lịch sử nạp tiền</h3>
          {adsData.entries.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Chưa có dữ liệu
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {adsData.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between bg-white border rounded-lg p-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-green-600">
                        {entry.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-sm text-gray-600">{entry.date}</span>
                      {entry.note && (
                        <span className="text-sm text-gray-500 italic">
                          {entry.note}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

