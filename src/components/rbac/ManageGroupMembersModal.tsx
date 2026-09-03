import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Search, Users, Check, UserPlus, Filter, X } from "lucide-react";
import { toast } from "sonner";
import type { PermissionGroup } from "../../lib/auth/rbac-definitions";

interface ManageGroupMembersModalProps {
  group: PermissionGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageGroupMembersModal: React.FC<ManageGroupMembersModalProps> = ({
  group,
  open,
  onOpenChange,
}) => {
  const { employees, orgUnits, updatePermissionGroup } = useApp();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  // Sync state when modal opens
  React.useEffect(() => {
    if (group && open) {
      setSelectedIds(group.memberUserIds || []);
      setSearchTerm("");
      setSelectedDepartment("all");
    }
  }, [group, open]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesDept =
        selectedDepartment === "all" ||
        emp.departmentId === selectedDepartment ||
        emp.departmentName === selectedDepartment;

      const fullName = `${emp.firstNameAr} ${emp.lastNameAr} ${emp.firstNameEn || ""} ${emp.lastNameEn || ""}`.toLowerCase();
      const matchesSearch =
        !searchTerm.trim() ||
        fullName.includes(searchTerm.toLowerCase()) ||
        emp.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.jobTitleAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDept && matchesSearch;
    });
  }, [employees, searchTerm, selectedDepartment]);

  const toggleEmployee = (empId: string) => {
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIdSet = new Set(filteredEmployees.map((e) => e.id));
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIdSet])));
  };

  const handleDeselectAllFiltered = () => {
    const filteredIdSet = new Set(filteredEmployees.map((e) => e.id));
    setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
  };

  const handleSave = () => {
    if (!group) return;
    updatePermissionGroup(group.id, { memberUserIds: selectedIds });
    toast.success(
      `تم تحديث أعضاء (${group.nameAr}) بنجاح! إجمالي الأعضاء الحاليين: ${selectedIds.length} مستخدم.`,
    );
    onOpenChange(false);
  };

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col rounded-3xl p-6 shadow-2xl border-border/80">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                style={{ backgroundColor: group.color || "#4f46e5" }}
              >
                <Users className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
                  إدارة أعضاء المجموعة: {group.nameAr}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                  حدد الموظفين والمستخدمين الذين ترغب في منحهم صلاحيات هذه المجموعة
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="rounded-full px-3 py-1 font-bold text-xs gap-1.5 self-start sm:self-center">
              <Users className="h-3.5 w-3.5 text-primary" />
              تم تحديد {selectedIds.length} من {employees.length} موظف
            </Badge>
          </div>
        </DialogHeader>

        {/* Filters and Search Bar */}
        <div className="py-3 space-y-2.5 border-b border-border/60">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث بالاسم، الرقم الوظيفي، المسمى، أو البريد..."
                className="w-full h-9 rounded-2xl border border-border/80 bg-muted/30 pr-9 pl-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="h-9 rounded-2xl border border-border/80 bg-muted/30 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
              >
                <option value="all">كافة الإدارات والأقسام ({employees.length})</option>
                {orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[11px] text-muted-foreground font-medium">
              النتائج المعروضة: {filteredEmployees.length} موظف
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-primary hover:underline font-bold text-[11px]"
              >
                تحديد المعروضين بالكامل
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="text-muted-foreground hover:text-destructive hover:underline font-medium text-[11px]"
              >
                إلغاء تحديد المعروضين
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Employee Multi-Select List */}
        <div className="flex-1 overflow-y-auto max-h-[420px] py-2 space-y-1.5 custom-scrollbar pr-1">
          {filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <Users className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-xs font-medium">لا يوجد موظفون يطابقون خيارات البحث أو التصفية.</p>
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const isSelected = selectedIds.includes(emp.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "border-border/70 hover:bg-muted/40 bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container
                      className="rounded-md text-primary focus:ring-primary h-4 w-4 pointer-events-none"
                    />

                    <Avatar className="h-9 w-9 rounded-xl border border-border/80">
                      <AvatarImage src={emp.avatarUrl} />
                      <AvatarFallback className="text-[11px] font-bold bg-secondary text-foreground">
                        {emp.firstNameAr?.[0]}
                        {emp.lastNameAr?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">
                          {emp.firstNameAr} {emp.lastNameAr}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4">
                          {emp.employeeNo}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{emp.jobTitleAr}</span>
                        <span>•</span>
                        <span className="text-primary font-medium">{emp.departmentName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold rounded-full px-2">
                        عضو نشط
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border/60 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-muted-foreground font-medium">
            يتم تطبيق صلاحيات المجموعة فوراً على المستخدمين المحددين.
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-full text-xs font-bold h-9 px-4"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="rounded-full text-xs font-bold h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
            >
              <Check className="h-4 w-4" />
              حفظ التعيينات ({selectedIds.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
