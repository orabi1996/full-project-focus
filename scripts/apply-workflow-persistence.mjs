import { readFileSync, writeFileSync } from "node:fs";

const path = "src/lib/context/AppContext.tsx";
let source = readFileSync(path, "utf8");

function replaceOnce(label, before, after) {
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "workflow repository imports",
  'import { executeReliableMutation } from "../data/reliable-mutation";',
  `import { executeReliableMutation } from "../data/reliable-mutation";\nimport {\n  createDelegationRuleRecord,\n  deleteApprovalChainRecord,\n  fetchDelegationRulesRecord,\n  revokeDelegationRuleRecord,\n} from "../data/workflow-repository";`,
);

replaceOnce(
  "live workflow snapshot",
  '      const operational = await fetchOperationalSnapshot(snapshot.employees, snapshot.orgUnits);',
  `      const [operational, delegationSnapshot] = await Promise.all([\n        fetchOperationalSnapshot(snapshot.employees, snapshot.orgUnits),\n        fetchDelegationRulesRecord(snapshot.employees),\n      ]);`,
);

replaceOnce(
  "live delegation state",
  "      setApprovalChains(operational.approvalChains);\n      setLeaveTypes(operational.leaveTypes);",
  "      setApprovalChains(operational.approvalChains);\n      setDelegationRules(delegationSnapshot);\n      setLeaveTypes(operational.leaveTypes);",
);

replaceOnce(
  "demo delegation reset",
  "    setApprovalChains(mockApprovalChains);\n    setAttendanceRecords(mockAttendanceRecords);",
  "    setApprovalChains(mockApprovalChains);\n    setDelegationRules(mockDelegationRules);\n    setAttendanceRecords(mockAttendanceRecords);",
);

replaceOnce(
  "workflow mutation handlers",
  `  const addApprovalChain = (chain: Omit<ApprovalChain, "id">) => {\n    const newChain: ApprovalChain = { ...chain, id: \`chain-\${Date.now()}\` };\n    setApprovalChains((prev) => [newChain, ...prev]);\n    persistLiveChange(() => createApprovalChainRecord(chain));\n    logAuditEvent(\n      "إنشاء مسار موافقات",\n      "ApprovalChain",\n      newChain.id,\n      newChain.nameAr,\n      \`نوع الطلب: \${newChain.requestType}\`,\n    );\n  };\n\n  const deleteApprovalChain = (id: string) => {\n    setApprovalChains((prev) => prev.filter((c) => c.id !== id));\n    toast.success("تم حذف مسار الاعتماد بنجاح");\n  };\n\n  const addDelegationRule = (rule: Omit<DelegationRule, "id" | "createdAt" | "status">) => {\n    const newRule: DelegationRule = {\n      ...rule,\n      id: \`del-\${Date.now()}\`,\n      status: "active",\n      createdAt: new Date().toISOString(),\n    };\n    setDelegationRules((prev) => [newRule, ...prev]);\n    toast.success(\`تم تفعيل تفويض الصلاحيات لـ (\${rule.delegateName}) بنجاح\`);\n    logAuditEvent(\n      "تفعيل تفويض صلاحيات",\n      "DelegationRule",\n      newRule.id,\n      rule.delegatorName,\n      \`المفوض له: \${rule.delegateName} | الفترة: \${rule.startDate} إلى \${rule.endDate}\`,\n    );\n  };\n\n  const revokeDelegationRule = (id: string) => {\n    setDelegationRules((prev) => prev.map((r) => (r.id === id ? { ...r, status: "revoked" } : r)));\n    toast.info("تم إلغاء التفويض بنجاح");\n  };`,
  `  const addApprovalChain = (chain: Omit<ApprovalChain, "id">) => {\n    const newChain: ApprovalChain = { ...chain, id: \`chain-\${Date.now()}\` };\n    setApprovalChains((prev) => [newChain, ...prev]);\n    void persistLiveChange(\n      () => createApprovalChainRecord(chain),\n      \`approval-chain:create:\${chain.requestType}:\${chain.nameAr}\`,\n    ).then(({ ok }) => {\n      if (!ok) return;\n      logAuditEvent(\n        "إنشاء مسار موافقات",\n        "ApprovalChain",\n        newChain.id,\n        newChain.nameAr,\n        \`نوع الطلب: \${newChain.requestType}\`,\n      );\n      toast.success("تم حفظ مسار الاعتماد بنجاح");\n    });\n  };\n\n  const deleteApprovalChain = (id: string) => {\n    const target = approvalChains.find((chain) => chain.id === id);\n    setApprovalChains((prev) => prev.filter((chain) => chain.id !== id));\n    void persistLiveChange(\n      () => deleteApprovalChainRecord(id),\n      \`approval-chain:delete:\${id}\`,\n    ).then(({ ok }) => {\n      if (!ok) return;\n      logAuditEvent(\n        "حذف مسار موافقات",\n        "ApprovalChain",\n        id,\n        target?.nameAr ?? id,\n        "تم حذف مسار الاعتماد من قاعدة البيانات",\n      );\n      toast.success("تم حذف مسار الاعتماد بنجاح");\n    });\n  };\n\n  const addDelegationRule = (rule: Omit<DelegationRule, "id" | "createdAt" | "status">) => {\n    const newRule: DelegationRule = {\n      ...rule,\n      id: \`del-\${Date.now()}\`,\n      status: "active",\n      createdAt: new Date().toISOString(),\n    };\n    setDelegationRules((prev) => [newRule, ...prev]);\n    void persistLiveChange(\n      () => createDelegationRuleRecord(rule),\n      \`delegation:create:\${rule.delegatorId}:\${rule.delegateId}:\${rule.startDate}:\${rule.endDate}\`,\n    ).then(({ ok }) => {\n      if (!ok) return;\n      logAuditEvent(\n        "تفعيل تفويض صلاحيات",\n        "DelegationRule",\n        newRule.id,\n        rule.delegatorName,\n        \`المفوض له: \${rule.delegateName} | الفترة: \${rule.startDate} إلى \${rule.endDate}\`,\n      );\n      toast.success(\`تم تفعيل تفويض الصلاحيات لـ (\${rule.delegateName}) بنجاح\`);\n    });\n  };\n\n  const revokeDelegationRule = (id: string) => {\n    const target = delegationRules.find((rule) => rule.id === id);\n    setDelegationRules((prev) =>\n      prev.map((rule) => (rule.id === id ? { ...rule, status: "revoked" } : rule)),\n    );\n    void persistLiveChange(\n      () => revokeDelegationRuleRecord(id),\n      \`delegation:revoke:\${id}\`,\n    ).then(({ ok }) => {\n      if (!ok) return;\n      logAuditEvent(\n        "إلغاء تفويض صلاحيات",\n        "DelegationRule",\n        id,\n        target?.delegatorName ?? id,\n        target ? \`تم إلغاء التفويض إلى: \${target.delegateName}\` : "تم إلغاء التفويض",\n      );\n      toast.info("تم إلغاء التفويض بنجاح");\n    });\n  };`,
);

writeFileSync(path, source);
console.log("AppContext workflow persistence patch applied successfully.");
