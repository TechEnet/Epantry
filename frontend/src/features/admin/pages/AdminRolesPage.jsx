import {
  CircleAlert,
  Check,
  ChevronDown,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Users,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";
import { createPortal } from "react-dom";

import { getAdminAssignableHosts } from "../services/admin.service";

import AdminShell from "../components/AdminShell";

import {
  useAdminPermissionCatalog,
  useAdminRoleManagementActions,
  useAdminRoles,
  useAdminUserRoleAssignment,
} from "../hooks/useAdminRoleManagement";

function getErrorMessage(error) {
  return error?.message || "Unable to complete this administrative request.";
}

function getRoleKey(role) {
  return role?.key || role?.roleKey || "";
}

// Keep role identifiers compatible with the existing backend validation.
// Display names remain unchanged; only the internal identifier is normalized.
function normalizeRoleKey(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "");

  const withLetterPrefix =
    normalized && !/^[a-z]/.test(normalized)
      ? `role_${normalized}`
      : normalized;

  return withLetterPrefix.slice(0, 64);
}

function getAssignmentRoleKeys(access) {
  const directKeys = access?.assignment?.roleKeys;

  if (Array.isArray(directKeys)) {
    return directKeys.map(String);
  }

  const roles = access?.roles;

  if (Array.isArray(roles)) {
    return roles.map(getRoleKey).filter(Boolean);
  }

  return [];
}

const PERMISSION_LABELS = {
  "admin.dashboard.read": "View admin dashboard",
  "admin.roles.read": "View admin roles",
  "admin.roles.manage": "Manage admin roles",
  "admin.assignments.read": "View admin access",
  "admin.assignments.manage": "Change admin access",
  "admin.audit.read": "View audit history",
  "host.review.read": "View Host reviews",
  "host.review.approve": "Approve Hosts",
  "host.review.reject": "Reject Host applications",
  "host.review.suspend": "Suspend Host access",
  "catalog.read": "View product catalog",
  "catalog.mutate": "Edit product catalog",
  "catalog.publish": "Publish products",
  "recipe.read": "View recipes",
  "recipe.mutate": "Edit recipes",
  "recipe.publish": "Publish recipes",
  "marketplace.read": "View marketplace operations",
  "marketplace.mutate": "Manage marketplace operations",
  "trust_safety.read": "View trust & safety",
  "trust_safety.mutate": "Manage trust & safety",
  "finance.read": "View finance",
  "finance.mutate": "Manage finance",
  "cms.read": "View site content",
  "cms.mutate": "Edit site content",
  "cms.publish": "Publish site content",
};

const PERMISSION_GROUPS = [
  { id: "admin", label: "Admin access", prefixes: ["admin."] },
  { id: "hosts", label: "Hosts", prefixes: ["host."] },
  { id: "catalog", label: "Catalog", prefixes: ["catalog."] },
  { id: "recipes", label: "Recipes", prefixes: ["recipe."] },
  { id: "marketplace", label: "Marketplace", prefixes: ["marketplace."] },
  { id: "finance", label: "Finance", prefixes: ["finance."] },
  { id: "content", label: "Content", prefixes: ["cms."] },
  { id: "safety", label: "Trust & safety", prefixes: ["trust_safety."] },
];

function titleizePermission(permissionKey) {
  const known = PERMISSION_LABELS[permissionKey];

  if (known) {
    return known;
  }

  return String(permissionKey || "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPermissionKey(permission) {
  return (
    permission?.key || permission?.permissionKey || String(permission || "")
  );
}

function getPermissionGroup(permissionKey) {
  return (
    PERMISSION_GROUPS.find((group) =>
      group.prefixes.some((prefix) =>
        String(permissionKey || "").startsWith(prefix)
      )
    ) || {
      id: "other",
      label: "Other access",
    }
  );
}

const STEPS = [
  {
    number: "01",
    title: "Review existing access",
    text: "Start with an EPANTRY role that already matches the job.",
    mobileText: "Start with a role that already fits.",
    href: "#role-library",
  },
  {
    number: "02",
    title: "Create only if needed",
    text: "Build a focused role only when the ready-made access is not enough.",
    mobileText: "Create one only when standard access falls short.",
    href: "#create-role",
  },
  {
    number: "03",
    title: "Choose a Host",
    text: "Choose a Host, then assign the admin role they need.",
    mobileText: "Select a Host and assign the needed role.",
    href: "#assign-access",
  },
  {
    number: "04",
    title: "Verify the change",
    text: "Open the audit history after an important access change.",
    mobileText: "Check audit history after the change.",
    to: "/admin/audit",
  },
];

function SectionTitle({ eyebrow, title, text, aside }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-stone-200 pb-3 sm:pb-4">
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-700 sm:text-[10px]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[16px] font-black tracking-[-0.025em] text-stone-950 sm:text-[22px]">
          {title}
        </h2>
        {text ? (
          <p className="mt-1 max-w-3xl text-[10px] font-medium leading-4 text-stone-500 sm:text-[12px] sm:leading-5">
            {text}
          </p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

export default function AdminRolesPage() {
  const {
    permissions,
    isLoading: isLoadingPermissions,
    error: permissionsError,
    refetch: refetchPermissions,
  } = useAdminPermissionCatalog();

  const {
    roles,
    isLoading: isLoadingRoles,
    error: rolesError,
    refetch: refetchRoles,
  } = useAdminRoles();

  const {
    createRole,
    deleteRole,
    grantUserRoles,
    updateUserRoles,
    revokeUserRoles,
    isMutatingAdminControlPlane,
  } = useAdminRoleManagementActions();

  const [roleForm, setRoleForm] = useState({
    key: "",
    name: "",
    description: "",
    permissionKeys: [],
  });

  // Mobile uses the existing four navigation steps as a focused work-area selector.
  // Desktop keeps all sections visible and retains the original anchor navigation.
  const [mobileWorkArea, setMobileWorkArea] = useState(() => {
    const section =
      typeof window === "undefined"
        ? ""
        : window.location.hash.replace("#", "");
    return ["role-library", "create-role", "assign-access"].includes(section)
      ? section
      : "role-library";
  });

  const [createError, setCreateError] = useState("");
  const [createdRoleKey, setCreatedRoleKey] = useState("");
  const [highlightRoleKey, setHighlightRoleKey] = useState("");
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [allHostsOpen, setAllHostsOpen] = useState(false);
  const [allHostQuery, setAllHostQuery] = useState("");
  const [debouncedAllHostQuery, setDebouncedAllHostQuery] = useState("");
  const [allHostPage, setAllHostPage] = useState(1);
  const [allHostOptions, setAllHostOptions] = useState([]);
  const [allHostTotal, setAllHostTotal] = useState(0);
  const [allHostMore, setAllHostMore] = useState(false);
  const [allHostLoading, setAllHostLoading] = useState(false);
  const [allHostError, setAllHostError] = useState("");
  const [allHostRetry, setAllHostRetry] = useState(0);

  const [hostQuery, setHostQuery] = useState("");
  const [debouncedHostQuery, setDebouncedHostQuery] = useState("");
  const [hostPickerOpen, setHostPickerOpen] = useState(false);
  const [hostPage, setHostPage] = useState(1);
  const [hostOptions, setHostOptions] = useState([]);
  const [hostTotal, setHostTotal] = useState(0);
  const [hasMoreHosts, setHasMoreHosts] = useState(false);
  const [isLoadingHosts, setIsLoadingHosts] = useState(false);
  const [hostDirectoryError, setHostDirectoryError] = useState("");
  const [hostRetry, setHostRetry] = useState(0);
  const [highlightedHost, setHighlightedHost] = useState(0);
  const [selectedHost, setSelectedHost] = useState(null);
  const hostPickerRef = useRef(null);
  const allHostSearchRef = useRef(null);
  const allHostNextPageLock = useRef(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleKeys, setSelectedRoleKeys] = useState([]);
  const [assignmentError, setAssignmentError] = useState("");

  const {
    access: userAccess,
    assignment,
    isLoading: isLoadingAssignment,
    error: assignmentLoadError,
  } = useAdminUserRoleAssignment(selectedUserId);

  useEffect(() => {
    if (!userAccess) {
      return;
    }

    setSelectedRoleKeys(getAssignmentRoleKeys(userAccess));
  }, [userAccess]);

  // Only fetch the Host directory while the picker is open.
  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedHostQuery(hostQuery.trim()),
      220
    );
    return () => clearTimeout(timeout);
  }, [hostQuery]);

  useEffect(() => {
    if (!hostPickerOpen || hostQuery.trim() !== debouncedHostQuery)
      return undefined;
    let active = true;
    setIsLoadingHosts(true);
    setHostDirectoryError("");
    getAdminAssignableHosts({
      search: debouncedHostQuery,
      page: hostPage,
      limit: 10,
    })
      .then(({ hosts, pagination }) => {
        if (!active) return;
        setHostOptions((existing) =>
          hostPage === 1
            ? hosts
            : [
                ...existing.filter(
                  (item) => !hosts.some((next) => next.id === item.id)
                ),
                ...hosts,
              ]
        );
        setHasMoreHosts(Boolean(pagination.hasMore));
        setHostTotal(Number(pagination.total || 0));
      })
      .catch((error) => {
        if (active) setHostDirectoryError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setIsLoadingHosts(false);
      });
    return () => {
      active = false;
    };
  }, [hostPickerOpen, debouncedHostQuery, hostQuery, hostPage, hostRetry]);

  useEffect(() => {
    if (!hostPickerOpen) return undefined;
    const handleOutside = (event) => {
      if (!hostPickerRef.current?.contains(event.target))
        setHostPickerOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [hostPickerOpen]);

  // Modal uses the same protected host-directory API, paged on scroll.
  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedAllHostQuery(allHostQuery.trim()),
      220
    );
    return () => clearTimeout(timeout);
  }, [allHostQuery]);

  useEffect(() => {
    if (!allHostsOpen || allHostQuery.trim() !== debouncedAllHostQuery)
      return undefined;
    let active = true;
    setAllHostLoading(true);
    setAllHostError("");
    getAdminAssignableHosts({
      search: debouncedAllHostQuery,
      page: allHostPage,
      limit: 25,
    })
      .then(({ hosts, pagination }) => {
        if (!active) return;
        setAllHostOptions((existing) =>
          allHostPage === 1
            ? hosts
            : [
                ...existing.filter(
                  (host) => !hosts.some((next) => next.id === host.id)
                ),
                ...hosts,
              ]
        );
        setAllHostTotal(Number(pagination.total || 0));
        setAllHostMore(Boolean(pagination.hasMore));
      })
      .catch((error) => {
        if (active) setAllHostError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) {
          setAllHostLoading(false);
          allHostNextPageLock.current = false;
        }
      });
    return () => {
      active = false;
    };
  }, [
    allHostsOpen,
    allHostQuery,
    debouncedAllHostQuery,
    allHostPage,
    allHostRetry,
  ]);

  useEffect(() => {
    if (!allHostsOpen && !roleToDelete) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        if (roleToDelete && !deleteBusy) setRoleToDelete(null);
        if (allHostsOpen) setAllHostsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [allHostsOpen, roleToDelete, deleteBusy]);

  useEffect(() => {
    if (!allHostsOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = window.setTimeout(
      () => allHostSearchRef.current?.focus(),
      40
    );
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(focus);
    };
  }, [allHostsOpen]);

  const openAllHosts = () => {
    allHostNextPageLock.current = false;
    setAllHostQuery(hostQuery);
    setDebouncedAllHostQuery(hostQuery.trim());
    setAllHostPage(1);
    setAllHostOptions([]);
    setAllHostError("");
    setHostPickerOpen(false);
    setAllHostsOpen(true);
  };

  const changeAllHostQuery = (value) => {
    allHostNextPageLock.current = false;
    setAllHostQuery(value);
    setAllHostPage(1);
    setAllHostOptions([]);
  };

  const handleAllHostScroll = (event) => {
    const list = event.currentTarget;
    if (
      !allHostLoading &&
      !allHostNextPageLock.current &&
      allHostMore &&
      !allHostError &&
      list.scrollHeight - list.scrollTop - list.clientHeight < 100
    ) {
      allHostNextPageLock.current = true;
      setAllHostPage((page) => page + 1);
    }
  };

  useEffect(() => {
    if (!createdRoleKey) return;
    const matched = roles.find((role) => getRoleKey(role) === createdRoleKey);
    if (!matched) return;
    const element = document.getElementById(`admin-role-${createdRoleKey}`);
    if (!element) return;
    setHighlightRoleKey(createdRoleKey);
    setCreatedRoleKey("");
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    element.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [createdRoleKey, roles]);

  useEffect(() => {
    if (!highlightRoleKey) return undefined;
    const timeout = window.setTimeout(() => setHighlightRoleKey(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [highlightRoleKey]);

  const confirmDeleteRole = async () => {
    if (!roleToDelete || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteRole({
        roleId: roleToDelete.id,
        reasonDetails: `Deleted unassigned custom role ${
          roleToDelete.name || roleToDelete.key
        } in Roles & Permissions.`,
      });
      setRoleToDelete(null);
      setHighlightRoleKey("");
    } catch (error) {
      setDeleteError(getErrorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  };

  const changeHostQuery = (value) => {
    setHostQuery(value);
    setSelectedHost(null);
    setSelectedUserId("");
    setSelectedRoleKeys([]);
    setAssignmentError("");
    setHostOptions([]);
    setHostPage(1);
    setHighlightedHost(0);
    setHostPickerOpen(true);
  };

  const selectHost = (host) => {
    if (!host.canAssign) return;
    setSelectedHost(host);
    setSelectedUserId(host.id);
    setSelectedRoleKeys([]);
    setAssignmentError("");
    setHostQuery("");
    setHostOptions([]);
    setHostPage(1);
    setHostPickerOpen(false);
    setAllHostsOpen(false);
  };

  const handleHostKeyboard = (event) => {
    if (event.key === "Escape") {
      setHostPickerOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!hostPickerOpen) {
        setHostPickerOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedHost((index) => {
        if (!hostOptions.length) return 0;
        let candidate = index;
        for (let attempts = 0; attempts < hostOptions.length; attempts++) {
          candidate =
            (candidate + direction + hostOptions.length) % hostOptions.length;
          if (hostOptions[candidate]?.canAssign) return candidate;
        }
        return index;
      });
    }
    if (event.key === "Enter" && hostPickerOpen) {
      event.preventDefault();
      const candidate = hostOptions[highlightedHost];
      if (candidate?.canAssign) selectHost(candidate);
    }
  };

  const delegablePermissions = useMemo(
    () => permissions.filter((permission) => permission?.delegable !== false),
    [permissions]
  );

  const groupedPermissions = useMemo(() => {
    const groups = new Map();

    delegablePermissions.forEach((permission) => {
      const permissionKey = getPermissionKey(permission);
      const group = getPermissionGroup(permissionKey);

      if (!groups.has(group.id)) {
        groups.set(group.id, {
          ...group,
          permissions: [],
        });
      }

      groups.get(group.id).permissions.push(permission);
    });

    return Array.from(groups.values());
  }, [delegablePermissions]);

  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role?.status !== "disabled" && getRoleKey(role) !== "root_super_admin"
      ),
    [roles]
  );

  const togglePermission = (permissionKey) => {
    setRoleForm((current) => ({
      ...current,
      permissionKeys: current.permissionKeys.includes(permissionKey)
        ? current.permissionKeys.filter((key) => key !== permissionKey)
        : [...current.permissionKeys, permissionKey],
    }));
  };

  const toggleRole = (roleKey) => {
    setSelectedRoleKeys((current) =>
      current.includes(roleKey)
        ? current.filter((key) => key !== roleKey)
        : [...current, roleKey]
    );
  };

  const submitNewRole = async (event) => {
    event.preventDefault();
    setCreateError("");

    const key = normalizeRoleKey(roleForm.key);
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(key)) {
      setCreateError("Enter an internal role ID of at least 3 characters.");
      return;
    }

    try {
      const created = await createRole({
        ...roleForm,
        key,
        reasonDetails: "Created through EPANTRY Roles & Permissions interface.",
      });
      setCreatedRoleKey(created?.role?.key || key);
      setMobileWorkArea("role-library");

      setRoleForm({
        key: "",
        name: "",
        description: "",
        permissionKeys: [],
      });
    } catch (error) {
      setCreateError(getErrorMessage(error));
    }
  };

  const saveAssignment = async () => {
    if (!selectedUserId) {
      return;
    }

    setAssignmentError("");

    try {
      if (assignment) {
        await updateUserRoles({
          userId: selectedUserId,
          roleKeys: selectedRoleKeys,
          reasonDetails:
            "Updated through EPANTRY Roles & Permissions interface.",
        });
      } else {
        await grantUserRoles({
          userId: selectedUserId,
          roleKeys: selectedRoleKeys,
          reasonDetails:
            "Granted through EPANTRY Roles & Permissions interface.",
        });
      }
    } catch (error) {
      setAssignmentError(getErrorMessage(error));
    }
  };

  const revokeAssignment = async () => {
    if (!selectedUserId) {
      return;
    }

    setAssignmentError("");

    try {
      await revokeUserRoles({
        userId: selectedUserId,
        reasonDetails: "Revoked through EPANTRY Roles & Permissions interface.",
      });

      setSelectedRoleKeys([]);
    } catch (error) {
      setAssignmentError(getErrorMessage(error));
    }
  };

  return (
    <AdminShell
      title="Roles & Permissions"
      description="Manage internal admin access without changing Customer or Host accounts."
      flushTop
    >
      <div className="ep-roles-v2" data-mobile-work-area={mobileWorkArea}>
        <style>{`
          .ep-roles-v2 { --ep-forest:#173F35; --ep-charcoal:#202421; --ep-sage:#DCE0CF; --ep-porcelain:#F7F6F2; --ep-clay:#C86C42; --ep-line:#D8DED5; color:var(--ep-charcoal); font-family:'Plus Jakarta Sans',Inter,sans-serif; }
          .ep-roles-v2 *, .ep-roles-v2 *::before, .ep-roles-v2 *::after { box-sizing:border-box; }
          .ep-roles-v2 .roles-hero { display:grid; grid-template-columns:minmax(0,1fr) 220px; background:var(--ep-forest)!important; color:var(--ep-porcelain)!important; border-top:3px solid var(--ep-clay); }
          .ep-roles-v2 .roles-hero-main { padding:28px 34px; }
          .ep-roles-v2 .roles-hero-kicker { font-size:14px!important; line-height:1.4!important; font-weight:700; color:#DCE0CF!important; }
          .ep-roles-v2 .roles-hero h2 { font-size:30px!important; line-height:1.17!important; font-weight:700!important; letter-spacing:-.035em; color:#F7F6F2!important; margin:8px 0; }
          .ep-roles-v2 .roles-hero p { margin:0; color:#E2EBE3!important; font-size:16px!important; line-height:1.6!important; }
          .ep-roles-v2 .roles-hero-stat { border-left:1px solid rgba(247,246,242,.2); padding:27px 28px; display:flex; flex-direction:column; justify-content:center; }
          .ep-roles-v2 .roles-hero-stat strong { font-size:48px!important; line-height:1.1!important; font-weight:700; color:#F7F6F2!important; }
          .ep-roles-v2 .roles-hero-stat span { font-size:16px!important; color:#DCE0CF!important; font-weight:600; }
          .ep-roles-v2 .roles-steps { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border:1px solid var(--ep-line); border-top:0; background:#F1F3EC!important; }
          .ep-roles-v2 .roles-step { position:relative; min-width:0; display:flex; align-items:center; gap:12px; padding:16px 18px; color:var(--ep-forest)!important; text-decoration:none; border-right:1px solid var(--ep-line); transition:background .18s; }
          .ep-roles-v2 .roles-step:last-child { border-right:0; }
          .ep-roles-v2 .roles-step:hover, .ep-roles-v2 .roles-step:focus-visible { background:var(--ep-sage)!important; }
          .ep-roles-v2 .roles-step-num { width:32px; height:32px; flex-shrink:0; display:grid; place-items:center; border-radius:50%; background:#F7F6F2!important; border:1px solid #BDCCBE; font-size:14px!important; font-weight:700; }
          .ep-roles-v2 .roles-step-title { font-size:16px!important; line-height:1.35!important; font-weight:700; color:var(--ep-forest)!important; }
          .ep-roles-v2 .roles-step-arrow { margin-left:auto; flex-shrink:0; opacity:.7; }
          .ep-roles-v2 .roles-section { margin-top:30px; }
          .ep-roles-v2 .roles-section-head { display:flex; justify-content:space-between; align-items:end; gap:18px; padding-bottom:14px; border-bottom:1px solid var(--ep-line); margin-bottom:0; }
          .ep-roles-v2 .roles-kicker { display:block; color:var(--ep-clay)!important; font-size:15px!important; line-height:1.35!important; font-weight:700; letter-spacing:0; }
          .ep-roles-v2 .roles-section-head h2, .ep-roles-v2 .roles-section-panel h2 { margin:4px 0 0; color:var(--ep-forest)!important; font-size:26px!important; line-height:1.22!important; letter-spacing:-.03em; font-weight:700!important; }
          .ep-roles-v2 .roles-section-head p, .ep-roles-v2 .roles-section-panel p { margin:5px 0 0; font-size:16px!important; line-height:1.5!important; color:#56645B!important; }
          .ep-roles-v2 .roles-pill { flex-shrink:0; display:inline-flex; padding:7px 11px; font-size:15px!important; font-weight:700; background:#EDF1E7!important; color:var(--ep-forest)!important; border-radius:30px; }
          .ep-roles-v2 .roles-table-head { display:grid; grid-template-columns:minmax(200px,1fr) minmax(0,1.65fr) 90px; gap:18px; padding:12px 18px; color:#58685E!important; background:#EBEFE7!important; font-size:15px!important; font-weight:700; }
          .ep-roles-v2 .roles-list { border:1px solid var(--ep-line); border-top:0; background:#FFFEFB!important; }
          .ep-roles-v2 .roles-list-row { display:grid; grid-template-columns:minmax(200px,1fr) minmax(0,1.65fr) 90px; gap:18px; padding:18px; border-bottom:1px solid var(--ep-line); align-items:start; background:#FFFEFB!important; transition:background .18s; }
          .ep-roles-v2 .roles-list-row:last-child { border-bottom:0; }
          .ep-roles-v2 .roles-list-row { scroll-margin-top:128px; }
          .ep-roles-v2 .roles-new-highlight { background:#EFF3E4!important; box-shadow:inset 5px 0 0 #C86C42, 0 0 0 2px rgba(200,108,66,.18); animation:ep-role-new-pulse 2.8s ease-out; }
          @keyframes ep-role-new-pulse { 0%,40% { background:#F8E4CE; } 100% { background:#EFF3E4; } }
          @media(prefers-reduced-motion:reduce) { .ep-roles-v2 .roles-new-highlight { animation:none; } }

          .ep-roles-v2 .roles-list-row:hover { background:#F4F6F0!important; }
          .ep-roles-v2 .roles-role-number { color:var(--ep-clay)!important; font-size:14px!important; font-weight:700; }
          .ep-roles-v2 .roles-role-name { font-size:17px!important; font-weight:700; color:var(--ep-forest)!important; line-height:1.35!important; overflow-wrap:anywhere; }
          .ep-roles-v2 .roles-role-desc { font-size:15px!important; color:#637168!important; line-height:1.5!important; margin:5px 0 0; }
          .ep-roles-v2 .roles-tag { display:inline-flex; align-items:center; border:1px solid #C7D4C8; padding:2px 7px; border-radius:4px; color:#315C49!important; font-size:13px!important; font-weight:700; white-space:nowrap; }
          .ep-roles-v2 .roles-tag-off { color:#A1372C!important; border-color:#E6C0B8; }
          .ep-roles-v2 .roles-permission-preview { display:flex; flex-wrap:wrap; gap:6px; }
          .ep-roles-v2 .roles-permission-preview span { padding:5px 8px; background:#EDF2E9!important; color:#37574B!important; border-radius:4px; font-size:14px!important; line-height:1.4!important; }
          .ep-roles-v2 .roles-permission-detail { margin-top:8px; }
          .ep-roles-v2 .roles-permission-detail summary { color:var(--ep-forest)!important; font-size:15px!important; font-weight:700; cursor:pointer; width:max-content; padding:3px 0; }
          .ep-roles-v2 .roles-all-permissions { margin-top:8px; display:grid; gap:6px; font-size:15px!important; color:#53665A!important; }
          .ep-roles-v2 .roles-all-permissions span { display:block; }
          .ep-roles-v2 .roles-action { justify-self:end; display:flex; align-items:center; gap:6px; border:1px solid #EACAC4; background:#FFF5F1!important; color:#A63A2F!important; padding:8px 10px; border-radius:7px; font-size:15px!important; font-weight:700; cursor:pointer; }
          .ep-roles-v2 .roles-action:hover { background:#FFE7E0!important; }
          .ep-roles-v2 .roles-action:disabled { opacity:.55; cursor:not-allowed; }
          .ep-roles-v2 .roles-section-panel { border:1px solid var(--ep-line); overflow:hidden; background:#FFFEFB!important; }
          /* Assign Access is a complete Clay-toned workspace, not an isolated orange input. */
          .ep-roles-v2 #assign-access { overflow:visible; border-color:#E6C6B1; background:#FFF8F2!important; }
          .ep-roles-v2 #assign-access .roles-panel-header { background:#F3DFD1!important; border-top-color:#C86C42; }
          .ep-roles-v2 #assign-access .roles-panel-header .roles-kicker { color:#A64F2D!important; }
          .ep-roles-v2 #assign-access .roles-panel-header > svg { color:#9A4F30!important; }
          .ep-roles-v2 #assign-access .roles-panel-inner { background:#FFF8F2!important; }
          .ep-roles-v2 #assign-access .roles-host-label { color:#173F35!important; }
          .ep-roles-v2 #assign-access .roles-assign-panel { border-top-color:#E7CABB; }
          .ep-roles-v2 #assign-access .roles-assign-row { border-bottom-color:#E9D7CB; }
          .ep-roles-v2 #assign-access .roles-assign-row:hover { background:#FBEAE0!important; }
          .ep-roles-v2 .roles-panel-header { padding:24px 28px; background:#E9EEE2!important; display:flex; justify-content:space-between; align-items:center; gap:20px; border-top:3px solid var(--ep-clay); }
          .ep-roles-v2 .roles-panel-header.is-blue { background:#E7EFF5!important; border-top-color:#3F7287; }
          .ep-roles-v2 .roles-panel-header h2 { font-size:26px!important; line-height:1.2!important; color:var(--ep-forest)!important; margin:4px 0; }
          .ep-roles-v2 .roles-panel-header p { font-size:16px!important; color:#516257!important; margin:3px 0 0; }
          .ep-roles-v2 .roles-panel-inner { padding:25px 28px 28px; background:#FFFEFB!important; }
          .ep-roles-v2 .roles-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
          .ep-roles-v2 .roles-field { display:block; min-width:0; }
          .ep-roles-v2 .roles-field > span { display:block; font-size:16px!important; font-weight:700; color:var(--ep-forest)!important; margin-bottom:8px; }
          .ep-roles-v2 .roles-field input, .ep-roles-v2 .roles-field textarea { display:block; width:100%; min-height:45px; padding:11px 12px; border:1px solid #CCD8CE!important; border-radius:7px; font-size:16px!important; line-height:1.5!important; background:#FFFFFF!important; color:var(--ep-charcoal)!important; outline:none; box-shadow:none; }
          .ep-roles-v2 .roles-field textarea { min-height:90px; resize:vertical; }
          .ep-roles-v2 .roles-field input:focus, .ep-roles-v2 .roles-field textarea:focus { outline:2px solid #7FAD95; outline-offset:1px; border-color:var(--ep-forest)!important; }
          .ep-roles-v2 .roles-field input::placeholder, .ep-roles-v2 .roles-field textarea::placeholder { color:#87928A!important; }
          .ep-roles-v2 .roles-matrix-top { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin:22px 0 12px; }
          .ep-roles-v2 .roles-matrix-top strong { font-size:18px!important; color:var(--ep-forest)!important; }
          .ep-roles-v2 .roles-matrix-top span { color:#496C55!important; font-size:15px!important; font-weight:700; white-space:nowrap; }
          .ep-roles-v2 .roles-permission-groups { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; align-items:start; }
          .ep-roles-v2 .roles-permission-group { min-width:0; border:1px solid var(--ep-line); border-radius:8px; background:#F7F8F4!important; }
          .ep-roles-v2 .roles-permission-group summary { display:flex; justify-content:space-between; align-items:center; gap:8px; cursor:pointer; padding:15px 16px; list-style:none; font-weight:700; font-size:16px!important; color:var(--ep-forest)!important; }
          .ep-roles-v2 .roles-permission-group summary::-webkit-details-marker { display:none; }
          .ep-roles-v2 .roles-permission-group summary::after { content:'⌄'; font-size:22px; font-weight:400; line-height:1; color:var(--ep-forest); }
          .ep-roles-v2 .roles-permission-group[open] summary::after { transform:rotate(180deg); }
          .ep-roles-v2 .roles-permission-group summary small { display:block; margin-top:3px; font-size:14px!important; font-weight:500; color:#718076!important; }
          .ep-roles-v2 .roles-permission-group .group-items { padding:4px 16px 13px; border-top:1px solid var(--ep-line); display:grid; gap:3px; }
          .ep-roles-v2 .roles-checkbox-row { display:flex; cursor:pointer; gap:10px; align-items:flex-start; padding:8px 2px; border-bottom:1px solid #E4EAE2; }
          .ep-roles-v2 .roles-checkbox-row:last-child { border-bottom:0; }
          .ep-roles-v2 .roles-checkbox-row input { width:17px; height:17px; margin-top:3px; accent-color:#173F35; flex-shrink:0; }
          .ep-roles-v2 .roles-checkbox-row .label-main { display:block; color:var(--ep-charcoal)!important; font-size:16px!important; line-height:1.45!important; font-weight:600; }
          .ep-roles-v2 .roles-checkbox-row .label-help { display:block; margin-top:3px; color:#67746C!important; font-size:14px!important; line-height:1.5!important; }
          .ep-roles-v2 .roles-form-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:21px; padding-top:18px; border-top:1px solid var(--ep-line); }
          .ep-roles-v2 .roles-button { min-height:44px; border-radius:7px; padding:11px 17px; font-size:16px!important; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; text-decoration:none; }
          .ep-roles-v2 .roles-button-primary { color:#F7F6F2!important; background:var(--ep-forest)!important; border:1px solid var(--ep-forest)!important; }
          .ep-roles-v2 .roles-button-primary:hover { background:#215345!important; }
          .ep-roles-v2 .roles-button-secondary { background:#F7F6F2!important; color:var(--ep-forest)!important; border:1px solid #AEC2B2!important; }
          .ep-roles-v2 .roles-button-secondary:hover { background:var(--ep-sage)!important; }
          .ep-roles-v2 .roles-button-danger { background:#FFF6F3!important; border:1px solid #E6AFA6!important; color:#9D332C!important; }
          .ep-roles-v2 .roles-button:disabled { opacity:.52; cursor:not-allowed; }
          .ep-roles-v2 .roles-error { display:flex; align-items:flex-start; gap:9px; background:#FFF0EC!important; color:#A4372E!important; padding:13px 15px; border-left:3px solid #C54B3B; margin:14px 0; font-size:16px!important; font-weight:600; line-height:1.5!important; }
          .ep-roles-v2 .roles-lookup { display:flex; align-items:end; gap:12px; }
          .ep-roles-v2 .roles-lookup .roles-field { flex:1; }
          .ep-roles-v2 .roles-host-picker { position:relative; max-width:680px; min-width:0; }
          .ep-roles-v2 .roles-host-label { display:block; font-size:16px!important; font-weight:700; color:var(--ep-forest)!important; margin-bottom:9px; }
          .ep-roles-v2 .roles-host-control { display:flex; align-items:center; min-height:52px; border:1px solid #D6AE95; background:#FFFEFB!important; border-radius:9px; overflow:hidden; transition:border-color .15s,box-shadow .15s; }
          .ep-roles-v2 .roles-host-control:focus-within { border-color:#AD542F; box-shadow:0 0 0 3px rgba(200,108,66,.18); }
          .ep-roles-v2 .roles-host-control > svg { margin-left:15px; flex-shrink:0; color:#A45230; }
          .ep-roles-v2 .roles-host-control input { flex:1; width:100%; min-width:0; height:50px; padding:11px 12px; background:transparent!important; outline:0!important; border:0!important; box-shadow:none!important; font-size:16px!important; color:#173F35!important; }
          .ep-roles-v2 .roles-host-control input::placeholder { color:#867A72!important; }
          .ep-roles-v2 .roles-host-chevron { height:50px; width:52px; flex-shrink:0; display:grid; place-items:center; border:0; border-left:1px solid #BD8D72; background:#C86C42!important; color:#FFFFFF!important; cursor:pointer; transition:background .15s; }
          .ep-roles-v2 .roles-host-chevron:hover, .ep-roles-v2 .roles-host-chevron:focus-visible { background:#A64F2D!important; outline-offset:-3px; }
          .ep-roles-v2 .roles-host-chevron[aria-expanded=true] svg { transform:rotate(180deg); }
          /* Keep the open list IN DOCUMENT FLOW so Assign Access grows and pushes
             Audit + Footer down instead of painting over them. */
          .ep-roles-v2 .roles-host-dropdown { position:relative; z-index:1; inset:auto; margin-top:8px; width:100%; max-height:none; display:flex; flex-direction:column; overflow:hidden; background:#FFFEFB!important; border:1px solid #E2BEAA; border-top:2px solid #C86C42; border-radius:9px; box-shadow:0 8px 22px rgba(77,43,27,.08); }
          .ep-roles-v2 .roles-host-dropdown-head { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-bottom:1px solid #ECD7C8; font-size:15px!important; font-weight:700; color:#7F4029!important; background:#F9EBE1!important; }
          .ep-roles-v2 .roles-host-scroll { max-height:278px; overflow-y:auto; overflow-x:hidden; min-height:0; overscroll-behavior:contain; }
          .ep-roles-v2 .roles-host-option { display:flex; width:100%; text-align:left; align-items:center; gap:12px; border:0; border-bottom:1px solid #F0E2D8; padding:13px 14px; background:#FFFEFB!important; cursor:pointer; color:#173F35!important; transition:background .15s,box-shadow .15s; }
          .ep-roles-v2 .roles-host-option:last-child { border-bottom:0; }
          .ep-roles-v2 .roles-host-option:hover, .ep-roles-v2 .roles-host-option.is-highlighted, .ep-roles-v2 .roles-host-option:focus-visible { background:#F8E6D9!important; box-shadow:inset 3px 0 0 #C86C42; outline:none; }
          .ep-roles-v2 .roles-host-option:disabled { cursor:not-allowed; opacity:.55; }
          .ep-roles-v2 .roles-host-avatar { display:grid; place-items:center; width:40px; height:40px; flex-shrink:0; border-radius:9px; background:#F3D5C1!important; color:#8C4428!important; font-weight:800; font-size:16px!important; }
          .ep-roles-v2 .roles-host-option-name { display:block; font-size:16px!important; font-weight:700; line-height:1.35!important; color:#173F35!important; }
          .ep-roles-v2 .roles-host-option-email { display:block; font-size:14px!important; line-height:1.45!important; color:#746C65!important; overflow-wrap:anywhere; }
          .ep-roles-v2 .roles-host-status { margin-left:auto; flex-shrink:0; border:1px solid #E9C3AA; border-radius:999px; background:#FFF2E8!important; padding:5px 8px; font-size:13px!important; font-weight:700; color:#8A472D!important; text-transform:capitalize; }
          .ep-roles-v2 .roles-host-empty { padding:17px 14px; font-size:16px!important; color:#56645B!important; }
          .ep-roles-v2 .roles-host-more { display:flex; align-items:center; justify-content:center; gap:8px; padding:13px; border:0; border-top:1px solid #E9C3AD; background:#F9E7DA!important; color:#824128!important; font-size:15px!important; font-weight:700; cursor:pointer; }
          .ep-roles-v2 .roles-host-more:hover { background:#F2D6C4!important; }
          .ep-roles-v2 .roles-selected-host { max-width:680px; margin-top:12px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; background:#F8E7DB!important; border-left:3px solid #C86C42; color:#173F35!important; }
          .ep-roles-v2 .roles-selected-host strong { font-size:16px!important; }
          .ep-roles-v2 .roles-selected-host span { display:block; font-size:14px!important; color:#85513D!important; }
          .ep-roles-v2 .roles-assign-panel { margin-top:20px; border-top:1px solid var(--ep-line); padding-top:18px; }
          .ep-roles-v2 .roles-assign-list { max-height:440px; overflow-y:auto; overscroll-behavior:contain; border:1px solid #E7CABB; border-radius:9px; }
          .ep-roles-v2 .roles-assign-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:9px; }
          .ep-roles-v2 .roles-assign-head strong { font-size:18px!important; color:var(--ep-forest)!important; }
          .ep-roles-v2 .roles-assign-head span { font-size:15px!important; color:#5D6B62!important; }
          .ep-roles-v2 .roles-assign-row { display:flex; align-items:center; gap:12px; padding:14px 10px; border-bottom:1px solid var(--ep-line); cursor:pointer; }
          .ep-roles-v2 .roles-assign-row:hover { background:#EFF3ED!important; }
          .ep-roles-v2 .roles-assign-row input { height:18px; width:18px; accent-color:#173F35; flex-shrink:0; }
          .ep-roles-v2 .roles-assign-row strong { font-size:16px!important; font-weight:700; color:var(--ep-forest)!important; }
          .ep-roles-v2 .roles-assign-row p { font-size:15px!important; line-height:1.5!important; margin:2px 0 0; color:#65736A!important; }
          .ep-roles-v2 .roles-assign-row .roles-status { margin-left:auto; font-size:14px!important; font-weight:700; color:#4D7258!important; }
          .ep-roles-v2 .roles-audit { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:30px; padding:20px 26px; border-top:3px solid var(--ep-clay); background:#E9EEE2!important; }
          .ep-roles-v2 .roles-audit h3 { font-size:20px!important; color:var(--ep-forest)!important; font-weight:700; margin:3px 0 0; line-height:1.2!important; }
          .ep-roles-v2 .roles-audit-link { color:var(--ep-forest)!important; border-bottom:2px solid var(--ep-clay); text-decoration:none; padding-bottom:3px; font-size:16px!important; font-weight:700; flex-shrink:0; }
          .ep-roles-v2 .roles-step:focus-visible, .ep-roles-v2 .roles-button:focus-visible, .ep-roles-v2 .roles-action:focus-visible, .ep-roles-v2 summary:focus-visible, .ep-roles-v2 .roles-audit-link:focus-visible { outline:3px solid #C86C42; outline-offset:2px; }
          /* Portalled dialogs use uniquely prefixed selectors to avoid global changes. */
          .ep-hosts-modal-scrim { position:fixed; inset:0; z-index:11000; display:flex; justify-content:center; align-items:center; padding:20px; background:rgba(20,36,29,.56); backdrop-filter:blur(9px); -webkit-backdrop-filter:blur(9px); }
          .ep-hosts-modal, .ep-role-delete-modal { width:min(690px,100%); max-height:min(85dvh,820px); display:flex; flex-direction:column; border:1px solid #E3C0AB; border-radius:16px; background:#FFF8F2; box-shadow:0 24px 78px rgba(15,40,30,.25); color:#173F35; font-family:'Plus Jakarta Sans',Inter,sans-serif; overflow:hidden; }
          .ep-hosts-modal-head { flex-shrink:0; background:#F3DFD1; border-top:4px solid #C86C42; display:flex; justify-content:space-between; align-items:center; gap:16px; padding:21px 24px; }
          .ep-hosts-modal-head span { font-size:14px; font-weight:700; color:#A64F2D; }
          .ep-hosts-modal-head h2 { color:#173F35!important; font-size:24px!important; font-weight:700; margin:4px 0 0; }
          .ep-hosts-modal-close { display:grid; place-items:center; width:40px; height:40px; flex-shrink:0; border:1px solid #D7B59F; border-radius:50%; background:#FFFEFB; color:#173F35; cursor:pointer; }
          .ep-hosts-modal-search { background:#FFF8F2; flex-shrink:0; padding:12px 20px; display:flex; align-items:center; gap:10px; border-bottom:1px solid #E8D5C7; }
          .ep-hosts-modal-search svg { flex-shrink:0; color:#A64F2D; }
          .ep-hosts-modal-search input { flex:1; min-width:0; padding:11px 7px; background:#FFFEFB!important; color:#173F35!important; border:1px solid #D9BAA7; border-radius:7px; font-size:16px!important; }
          .ep-hosts-modal-search > span { flex-shrink:0; color:#92533B; font-size:14px; font-weight:700; }
          .ep-hosts-modal-list { min-height:120px; overflow-y:auto; overscroll-behavior:contain; background:#FFFEFB; }
          .ep-hosts-modal-row { display:flex; width:100%; min-width:0; align-items:center; text-align:left; gap:12px; padding:14px 20px; border:0; border-bottom:1px solid #F0DED4; background:#FFFEFB; color:#173F35; cursor:pointer; }
          .ep-hosts-modal-row:hover, .ep-hosts-modal-row:focus-visible { background:#F8E6D9; box-shadow:inset 3px 0 0 #C86C42; outline:none; }
          .ep-hosts-modal-row:disabled { opacity:.55; cursor:not-allowed; }
          .ep-hosts-modal-avatar { display:grid; place-items:center; flex-shrink:0; width:39px; height:39px; border-radius:8px; background:#F3D5C1; color:#8C4428; font-weight:800; }
          .ep-hosts-modal-identity { display:block; flex:1; min-width:0; }
          .ep-hosts-modal-identity strong { display:block; font-size:16px; color:#173F35; overflow-wrap:anywhere; }
          .ep-hosts-modal-identity small { display:block; font-size:14px; color:#6D655F; overflow-wrap:anywhere; }
          .ep-hosts-modal-status { font-size:14px; color:#915337; text-transform:capitalize; }
          .ep-hosts-modal-empty { padding:18px 20px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; font-size:16px; color:#625A56; }
          .ep-hosts-modal-empty button, .ep-hosts-modal-foot button { border:1px solid #D3A88D; border-radius:7px; background:#FFF8F2; color:#87432A; padding:10px 16px; font-weight:700; cursor:pointer; }
          .ep-hosts-modal-foot { background:#F3DFD1; border-top:1px solid #E3C8B5; padding:10px 20px; text-align:center; }
          .ep-role-delete-modal { max-width:450px; padding:26px; gap:14px; background:#FFFEFB; }
          .ep-role-delete-icon { width:46px; height:46px; border-radius:11px; display:grid; place-items:center; background:#FCE1DC; color:#A4372E; }
          .ep-role-delete-modal h2 { font-size:24px!important; font-weight:700; margin:0; color:#173F35!important; }
          .ep-role-delete-modal p { font-size:16px!important; line-height:1.65!important; margin:0; color:#516257!important; }
          .ep-role-delete-error { border-left:3px solid #B63D32; background:#FFF0EC; color:#A4372E; padding:12px; font-size:15px; }
          .ep-role-delete-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:5px; }
          .ep-role-delete-actions button { border:1px solid #D0D9D0; border-radius:8px; padding:11px 16px; font-size:16px; font-weight:700; background:#F7F6F2; color:#173F35; cursor:pointer; }
          .ep-role-delete-actions .ep-role-delete-confirm { color:#fff; border-color:#AA4437; background:#AA4437; }
          .ep-role-delete-actions button:disabled { opacity:.6; cursor:not-allowed; }
          @media(max-width:650px) { .ep-hosts-modal-scrim { padding:12px; } .ep-hosts-modal-head { padding:17px; } .ep-hosts-modal-head h2 { font-size:20px!important; } .ep-hosts-modal-search { padding:10px; flex-wrap:wrap; } .ep-hosts-modal-row { padding:12px; } .ep-role-delete-modal { padding:19px; } }

          @media(max-width:900px) { .ep-roles-v2 .roles-steps { grid-template-columns:repeat(2,minmax(0,1fr)); } .ep-roles-v2 .roles-step:nth-child(2){ border-right:0; } .ep-roles-v2 .roles-step:nth-child(-n+2){ border-bottom:1px solid var(--ep-line); } .ep-roles-v2 .roles-list-row,.ep-roles-v2 .roles-table-head { grid-template-columns:minmax(170px,1fr) minmax(0,1.45fr) 90px; } }
          @media(max-width:650px) {
            .ep-roles-v2 .roles-hero { grid-template-columns:minmax(0,1fr) 88px; }
            .ep-roles-v2 .roles-hero-main { padding:19px 15px; }
            .ep-roles-v2 .roles-hero h2 { font-size:23px!important; }
            .ep-roles-v2 .roles-hero p { font-size:15px!important; line-height:1.5!important; }
            .ep-roles-v2 .roles-hero-stat { padding:17px 10px; text-align:center; }
            .ep-roles-v2 .roles-hero-stat strong { font-size:33px!important; }
            .ep-roles-v2 .roles-hero-stat span { font-size:14px!important; }
            .ep-roles-v2 .roles-steps { grid-template-columns:repeat(2,minmax(0,1fr)); }
            .ep-roles-v2 .roles-step { padding:12px 9px; gap:7px; }
            .ep-roles-v2 .roles-step-num { width:25px; height:25px; font-size:13px!important; }
            .ep-roles-v2 .roles-step-title { font-size:14px!important; }
            .ep-roles-v2 .roles-step-arrow { display:none; }
            .ep-roles-v2 .roles-section { margin-top:24px; }
            .ep-roles-v2 .roles-section-head { align-items:start; }
            .ep-roles-v2 .roles-section-head h2, .ep-roles-v2 .roles-panel-header h2 { font-size:22px!important; }
            .ep-roles-v2 .roles-kicker { font-size:14px!important; }
            .ep-roles-v2 .roles-table-head { display:none; }
            .ep-roles-v2 .roles-list { border-top:1px solid var(--ep-line); }
            .ep-roles-v2 .roles-list-row { grid-template-columns:minmax(0,1fr) auto; gap:12px; padding:16px; }
            .ep-roles-v2 .roles-row-access { grid-column:1/-1; }
            .ep-roles-v2 .roles-action { grid-column:2; grid-row:1; }
            .ep-roles-v2 .roles-permission-preview span { font-size:14px!important; }
            .ep-roles-v2 .roles-panel-header { padding:18px 17px; }
            .ep-roles-v2 .roles-panel-inner { padding:18px 16px 20px; }
            .ep-roles-v2 .roles-form-grid, .ep-roles-v2 .roles-permission-groups { grid-template-columns:1fr; }
            .ep-roles-v2 .roles-field input, .ep-roles-v2 .roles-field textarea { font-size:16px!important; }
            .ep-roles-v2 .roles-host-picker { max-width:none; }
            .ep-roles-v2 .roles-host-dropdown { max-height:none; }
            .ep-roles-v2 .roles-host-scroll { max-height:258px; }
            .ep-roles-v2 .roles-host-option { padding:10px; gap:9px; }
            .ep-roles-v2 .roles-host-status { font-size:13px!important; }
            .ep-roles-v2 .roles-lookup { align-items:stretch; gap:8px; }
            .ep-roles-v2 .roles-lookup button { align-self:end; }
            .ep-roles-v2 .roles-form-actions { flex-direction:column; }
            .ep-roles-v2 .roles-audit { padding:16px 17px; }
            .ep-roles-v2 .roles-audit h3 { font-size:18px!important; }
            .ep-roles-v2 .roles-audit-link { font-size:15px!important; }
          }

          /* Mobile-only Roles & Permissions polish. Approved desktop design stays unchanged. */
          .ep-roles-v2 .roles-mobile-access { display:none; }
          @media (max-width:650px) {
            .ep-roles-v2 { width:100%; min-width:0; }
            .ep-roles-v2 .roles-hero { grid-template-columns:minmax(0,1fr) 76px; }
            .ep-roles-v2 .roles-hero-main { padding:17px 15px 16px; }
            .ep-roles-v2 .roles-hero-kicker { font-size:14px!important; }
            .ep-roles-v2 .roles-hero h2 { margin:5px 0 7px; font-size:24px!important; line-height:1.24!important; letter-spacing:-.025em; }
            .ep-roles-v2 .roles-hero p { font-size:15px!important; line-height:1.42!important; }
            .ep-roles-v2 .roles-hero-stat { padding:12px 7px; }
            .ep-roles-v2 .roles-hero-stat strong { font-size:30px!important; }
            .ep-roles-v2 .roles-hero-stat span { font-size:13px!important; line-height:1.32!important; }
            .ep-roles-v2 .roles-steps { gap:0; }
            .ep-roles-v2 .roles-step { min-height:48px; padding:9px 10px; gap:9px; }
            .ep-roles-v2 .roles-step-num { width:25px; height:25px; }
            .ep-roles-v2 .roles-step-title { font-size:15px!important; line-height:1.3!important; }
            .ep-roles-v2 .roles-section { margin-top:22px; }
            .ep-roles-v2 .roles-section-head { align-items:center; gap:10px; padding-bottom:10px; }
            .ep-roles-v2 .roles-kicker { font-size:14px!important; }
            .ep-roles-v2 .roles-section-head h2,
            .ep-roles-v2 .roles-section-panel h2,
            .ep-roles-v2 .roles-panel-header h2 { font-size:24px!important; line-height:1.25!important; }
            .ep-roles-v2 .roles-section-head p { font-size:14px!important; line-height:1.4!important; }
            .ep-roles-v2 .roles-pill { padding:5px 8px; font-size:14px!important; }
            .ep-roles-v2 .roles-list-row { grid-template-columns:minmax(0,1fr) auto; gap:7px 9px; padding:12px 13px; align-items:start; }
            .ep-roles-v2 .roles-list-row > div:last-child { grid-column:2; grid-row:1; justify-self:end; }
            .ep-roles-v2 .roles-list-row > div:last-child:empty { display:none; }
            .ep-roles-v2 .roles-role-number { font-size:14px!important; }
            .ep-roles-v2 .roles-role-name { font-size:17px!important; line-height:1.38!important; }
            .ep-roles-v2 .roles-tag { font-size:13px!important; padding:2px 6px; }
            .ep-roles-v2 .roles-role-desc { font-size:14px!important; line-height:1.4!important; margin-top:3px; }
            .ep-roles-v2 .roles-row-access { min-width:0; padding-top:1px; }
            .ep-roles-v2 .roles-permission-preview,
            .ep-roles-v2 .roles-permission-detail { display:none; }
            .ep-roles-v2 .roles-mobile-access { display:block; }
            .ep-roles-v2 .roles-mobile-access summary { display:flex; width:fit-content; align-items:center; gap:6px; list-style:none; cursor:pointer; min-height:32px; padding:4px 0; color:var(--ep-forest)!important; font-weight:700; font-size:15px!important; }
            .ep-roles-v2 .roles-mobile-access summary::-webkit-details-marker { display:none; }
            .ep-roles-v2 .roles-mobile-access summary svg { flex-shrink:0; transition:transform .15s; }
            .ep-roles-v2 .roles-mobile-access[open] summary svg { transform:rotate(180deg); }
            .ep-roles-v2 .roles-mobile-access summary:focus-visible { outline:2px solid var(--ep-clay); outline-offset:2px; }
            .ep-roles-v2 .roles-mobile-access-list { border-top:1px solid var(--ep-line); margin-top:3px; padding:7px 0 3px; display:grid; gap:5px; }
            .ep-roles-v2 .roles-mobile-access-list span { display:block; color:#53665A!important; font-size:14px!important; line-height:1.45!important; }
            .ep-roles-v2 .roles-action { min-height:36px; padding:7px 9px; font-size:14px!important; white-space:nowrap; }
            .ep-roles-v2 .roles-panel-header { padding:15px 16px; gap:8px; }
            .ep-roles-v2 .roles-panel-header > svg { width:23px; height:23px; flex-shrink:0; }
            .ep-roles-v2 .roles-panel-header p { margin-top:3px; font-size:14px!important; line-height:1.42!important; }
            .ep-roles-v2 .roles-panel-inner { padding:16px 14px 18px; }
            .ep-roles-v2 .roles-form-grid { gap:13px; }
            .ep-roles-v2 .roles-field > span { margin-bottom:6px; font-size:15px!important; }
            .ep-roles-v2 .roles-field input { min-height:46px; }
            .ep-roles-v2 .roles-field textarea { min-height:76px; }
            .ep-roles-v2 .roles-matrix-top { margin:16px 0 10px; }
            .ep-roles-v2 .roles-matrix-top strong { font-size:17px!important; }
            .ep-roles-v2 .roles-permission-groups { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; align-items:start; }
            .ep-roles-v2 .roles-permission-group[open] { grid-column:1/-1; }
            .ep-roles-v2 .roles-permission-group summary { padding:12px 10px; min-height:54px; font-size:15px!important; gap:4px; }
            .ep-roles-v2 .roles-permission-group summary::after { font-size:18px; }
            .ep-roles-v2 .roles-permission-group summary small { font-size:13px!important; line-height:1.35!important; }
            .ep-roles-v2 .roles-permission-group .group-items { padding:4px 12px 9px; }
            .ep-roles-v2 .roles-checkbox-row { padding:9px 1px; }
            .ep-roles-v2 .roles-checkbox-row input { width:18px; height:18px; }
            .ep-roles-v2 .roles-checkbox-row .label-main { font-size:16px!important; }
            .ep-roles-v2 .roles-checkbox-row .label-help { font-size:14px!important; }
            .ep-roles-v2 .roles-form-actions { margin-top:15px; padding-top:14px; }
            .ep-roles-v2 .roles-form-actions .roles-button { width:100%; }
            .ep-roles-v2 .roles-host-picker, .ep-roles-v2 .roles-selected-host { width:100%; }
            .ep-roles-v2 .roles-host-label { margin-bottom:7px; }
            .ep-roles-v2 .roles-host-control, .ep-roles-v2 .roles-host-control input, .ep-roles-v2 .roles-host-chevron { min-height:48px; height:48px; }
            .ep-roles-v2 .roles-host-chevron { width:48px; }
            .ep-roles-v2 .roles-host-scroll { max-height:252px; }
            .ep-roles-v2 .roles-host-option-name { font-size:15px!important; }
            .ep-roles-v2 .roles-host-option-email { font-size:14px!important; }
            .ep-roles-v2 .roles-host-status { font-size:13px!important; }
            .ep-roles-v2 .roles-assign-panel { margin-top:16px; padding-top:14px; }
            .ep-roles-v2 .roles-assign-head strong { font-size:16px!important; }
            .ep-roles-v2 .roles-assign-row { padding:12px 8px; }
            .ep-roles-v2 .roles-audit { margin-top:22px; padding:13px 14px; }
            .ep-roles-v2 .roles-audit h3 { font-size:19px!important; }
            .ep-roles-v2 .roles-audit-link { font-size:14px!important; }
          }
          @media (max-width:359px) {
            .ep-roles-v2 .roles-permission-groups { grid-template-columns:minmax(0,1fr); }
          }

          /* Roles & Permissions: page-scoped mobile width, hierarchy and density.
             No shared shell component, desktop styles or action handlers change. */
          @media (max-width:650px) {
            /* Undo only this page's shell/frame gutters on phones. */
            .page-shell:has(.ep-roles-v2) {
              width:100%!important; max-width:none!important;
              margin-inline:0!important; padding-inline:0!important;
            }
            .page-shell:has(.ep-roles-v2) > div {
              border:0!important; border-radius:0!important; box-shadow:none!important;
            }
            .epantry-workspace-canvas:has(.ep-roles-v2) > div {
              padding:0!important;
            }
            .epantry-workspace-canvas:has(.ep-roles-v2) > header {
              padding:12px 18px 16px!important;
            }
            .epantry-workspace-canvas:has(.ep-roles-v2) > header h1 {
              font-size:26px!important; line-height:1.16!important;
              letter-spacing:-.035em!important;
            }
            .epantry-workspace-canvas:has(.ep-roles-v2) > header p {
              font-size:13px!important; line-height:1.45!important;
              font-weight:500!important;
            }
            .epantry-workspace-canvas:has(.ep-roles-v2) > header .uppercase {
              font-size:11px!important; line-height:1.4!important;
              letter-spacing:.08em!important;
            }
            .ep-roles-v2 { width:100%; min-width:0; }
            .ep-roles-v2 .roles-hero {
              grid-template-columns:minmax(0,1fr);
            }
            .ep-roles-v2 .roles-hero-main { padding:20px 18px 17px; }
            .ep-roles-v2 .roles-hero h2 {
              font-size:25px!important; line-height:1.18!important;
              max-width:22ch;
            }
            .ep-roles-v2 .roles-hero p {
              font-size:14px!important; line-height:1.5!important;
            }
            .ep-roles-v2 .roles-hero-stat {
              display:flex; flex-direction:row; align-items:center;
              justify-content:flex-start; gap:10px; text-align:left;
              border-left:0; border-top:1px solid rgba(247,246,242,.22);
              padding:9px 18px;
            }
            .ep-roles-v2 .roles-hero-stat strong {
              font-size:29px!important; line-height:1.1!important;
            }
            .ep-roles-v2 .roles-hero-stat span {
              font-size:14px!important; line-height:1.4!important;
            }
            .ep-roles-v2 .roles-step {
              min-height:54px; padding:10px 17px; gap:9px;
            }
            .ep-roles-v2 .roles-step-title { font-size:15px!important; }
            .ep-roles-v2 .roles-section { margin-top:0; }
            .ep-roles-v2 .roles-section-head {
              padding:22px 18px 13px; margin:0; align-items:center;
              gap:10px;
            }
            .ep-roles-v2 .roles-section-head > div { min-width:0; }
            .ep-roles-v2 .roles-section-head h2 {
              font-size:23px!important; line-height:1.23!important;
            }
            .ep-roles-v2 .roles-section-head p {
              font-size:14px!important; line-height:1.45!important;
            }
            .ep-roles-v2 .roles-pill { font-size:13px!important; }
            .ep-roles-v2 .roles-list {
              border-left:0; border-right:0;
            }
            .ep-roles-v2 .roles-list-row {
              padding:14px 18px; gap:4px 10px;
            }
            .ep-roles-v2 .roles-role-name {
              font-size:17px!important; line-height:1.35!important;
            }
            .ep-roles-v2 .roles-role-desc {
              font-size:14px!important; line-height:1.43!important;
              margin-top:3px;
            }
            .ep-roles-v2 .roles-row-access {
              grid-column:1/-1; padding-top:0;
            }
            .ep-roles-v2 .roles-mobile-access summary {
              min-height:36px; font-size:15px!important;
            }
            .ep-roles-v2 .roles-mobile-access-list span {
              font-size:14px!important; line-height:1.45!important;
            }
            .ep-roles-v2 .roles-action { min-height:40px; }
            .ep-roles-v2 .roles-section-panel {
              margin-top:17px; border-left:0; border-right:0;
            }
            .ep-roles-v2 .roles-panel-header { padding:19px 18px 17px; }
            .ep-roles-v2 .roles-panel-header h2 {
              font-size:23px!important;
            }
            .ep-roles-v2 .roles-panel-header p {
              font-size:14px!important; line-height:1.45!important;
            }
            .ep-roles-v2 .roles-panel-inner { padding:17px 18px 22px; }
            .ep-roles-v2 .roles-form-grid { gap:14px; }
            .ep-roles-v2 .roles-panel-inner > .roles-field {
              margin-top:14px!important;
            }
            .ep-roles-v2 .roles-field > span { font-size:15px!important; }
            .ep-roles-v2 .roles-field input {
              min-height:50px; font-size:16px!important;
            }
            .ep-roles-v2 .roles-field textarea { min-height:86px; }
            .ep-roles-v2 .roles-permission-groups { gap:9px; }
            .ep-roles-v2 .roles-permission-group summary {
              min-height:62px; padding:12px;
            }
            .ep-roles-v2 .roles-permission-group summary span {
              min-width:0; overflow-wrap:anywhere;
            }
            .ep-roles-v2 .roles-permission-group summary small {
              font-size:13px!important;
            }
            .ep-roles-v2 .roles-host-picker,
            .ep-roles-v2 .roles-selected-host { max-width:none; width:100%; }
            .ep-roles-v2 .roles-host-control { min-height:52px; }
            .ep-roles-v2 .roles-host-control input,
            .ep-roles-v2 .roles-host-chevron { height:52px; }
            .ep-roles-v2 .roles-host-option { padding:12px; }
            .ep-roles-v2 .roles-audit {
              margin-top:17px; padding:17px 18px; gap:12px;
            }
            .ep-roles-v2 .roles-audit h3 { font-size:19px!important; }
            .ep-roles-v2 .roles-audit-link { font-size:14px!important; }
          }

          /* Final mobile-only editorial layout. No desktop selectors or permission logic changed. */
          .ep-roles-v2 .roles-mobile-card { display:none; }
          @media (max-width:650px) {
            .epantry-workspace-canvas:has(.ep-roles-v2) > header {
              padding:13px 16px 17px!important;
            }
            .epantry-workspace-canvas:has(.ep-roles-v2) > header h1 {
              font-size:27px!important; line-height:1.16!important;
            }
            .epantry-workspace-canvas:has(.ep-roles-v2) > header p {
              font-size:14px!important; line-height:1.45!important;
            }
            .ep-roles-v2 { background:#F7F6F2!important; padding-bottom:1px; }
            .ep-roles-v2 .roles-hero {
              grid-template-columns:minmax(0,1fr)!important;
              background:#E7EFE7!important;
              color:#173F35!important;
              border-top:0!important;
              border-left:4px solid #173F35;
            }
            .ep-roles-v2 .roles-hero-main { padding:20px 17px 18px!important; }
            .ep-roles-v2 .roles-hero-kicker {
              font-size:12px!important; color:#A75F43!important; font-weight:800;
              letter-spacing:.055em;
            }
            .ep-roles-v2 .roles-hero h2 {
              color:#173F35!important; font-size:24px!important; line-height:1.17!important;
              letter-spacing:-.03em!important; max-width:none;
              margin:7px 0 7px!important;
            }
            .ep-roles-v2 .roles-hero p {
              color:#526358!important; font-size:14px!important; line-height:1.5!important;
            }
            .ep-roles-v2 .roles-hero-stat {
              background:#DAE8DB!important; border-top:1px solid #C6D8C9!important;
              padding:10px 17px!important; gap:8px!important;
            }
            .ep-roles-v2 .roles-hero-stat strong {
              font-size:23px!important; color:#173F35!important;
            }
            .ep-roles-v2 .roles-hero-stat span {
              font-size:14px!important; color:#365749!important;
            }
            .ep-roles-v2 .roles-steps {
              grid-template-columns:repeat(2,minmax(0,1fr))!important;
              padding:12px!important; gap:8px!important;
              border:0!important; background:#F7F6F2!important;
            }
            .ep-roles-v2 .roles-step,
            .ep-roles-v2 .roles-step:nth-child(2),
            .ep-roles-v2 .roles-step:nth-child(-n+2) {
              min-height:54px!important; padding:9px 10px!important;
              border:1px solid #D9E2DA!important; border-radius:9px!important;
              background:#FFFEFC!important; gap:8px!important;
            }
            .ep-roles-v2 .roles-step-num {
              width:27px!important; height:27px!important; border:0!important;
              background:#E9F1EA!important; font-size:12px!important;
            }
            .ep-roles-v2 .roles-step-title { font-size:14px!important; line-height:1.25!important; }
            .ep-roles-v2 .roles-section-head {
              padding:20px 16px 13px!important; align-items:center;
              border-bottom:0!important;
            }
            .ep-roles-v2 .roles-kicker { color:#A75F43!important; font-size:12px!important; }
            .ep-roles-v2 .roles-section-head h2 { font-size:22px!important; }
            .ep-roles-v2 .roles-section-head p { color:#5D6A61!important; font-size:14px!important; }
            .ep-roles-v2 .roles-pill {
              padding:6px 9px!important; background:#E4EBE1!important;
              border-radius:8px!important; font-size:13px!important;
            }
            .ep-roles-v2 .roles-list {
              margin:0 12px!important; border:1px solid #DAE1D9!important;
              border-radius:13px!important; overflow:hidden!important;
              background:#FFFEFC!important;
            }
            .ep-roles-v2 .roles-list-row {
              display:block!important; padding:0!important; margin:0!important;
              background:#FFFEFC!important; border-bottom:1px solid #E6E9E4!important;
              box-shadow:none!important;
            }
            .ep-roles-v2 .roles-list-row:hover { background:#FFFEFC!important; }
            .ep-roles-v2 .roles-list-row > .roles-desktop-cell { display:none!important; }
            .ep-roles-v2 .roles-mobile-card { display:block!important; width:100%; }
            .ep-roles-v2 .roles-mobile-card > summary {
              list-style:none!important; display:flex!important; align-items:center;
              min-width:0; gap:10px; padding:14px 12px;
              cursor:pointer; color:#173F35!important; background:transparent!important;
              min-height:70px;
            }
            .ep-roles-v2 .roles-mobile-card > summary::-webkit-details-marker { display:none; }
            .ep-roles-v2 .roles-mobile-card > summary:focus-visible {
              outline:3px solid #C86C42!important; outline-offset:-3px;
            }
            .ep-roles-v2 .roles-mobile-card[open] > summary { background:#EEF3EB!important; }
            .ep-roles-v2 .roles-mobile-card-index {
              display:grid; place-items:center; flex-shrink:0;
              width:32px; height:32px; border-radius:9px;
              background:#EFF1EA!important; color:#AA6246!important;
              font-size:13px!important; font-weight:800;
            }
            .ep-roles-v2 .roles-mobile-card-title { flex:1; min-width:0; }
            .ep-roles-v2 .roles-mobile-card-title strong {
              display:block; color:#173F35!important;
              font-size:16px!important; font-weight:700; line-height:1.25!important;
              overflow-wrap:anywhere;
            }
            .ep-roles-v2 .roles-mobile-card-subtitle {
              display:block; color:#69766D!important; font-size:12.5px!important;
              line-height:1.35!important; margin-top:3px;
            }
            .ep-roles-v2 .roles-mobile-card-count {
              flex-shrink:0; font-size:12px!important; font-weight:700;
              color:#5C6B61!important; white-space:nowrap;
            }
            .ep-roles-v2 .roles-mobile-card-chevron {
              flex-shrink:0; color:#335B48!important;
              transition:transform .18s ease;
            }
            .ep-roles-v2 .roles-mobile-card[open] .roles-mobile-card-chevron { transform:rotate(180deg); }
            .ep-roles-v2 .roles-mobile-card-body {
              border-top:1px solid #DDE7DD; background:#F7FAF6!important;
              padding:14px 14px 16px;
            }
            .ep-roles-v2 .roles-mobile-card-desc {
              font-size:14px!important; line-height:1.5!important;
              margin:0 0 12px!important; color:#526158!important;
            }
            .ep-roles-v2 .roles-mobile-card-permissions { display:grid; gap:0; }
            .ep-roles-v2 .roles-mobile-card-permissions span {
              display:flex; align-items:center; gap:9px; min-height:39px;
              padding:8px 2px; border-bottom:1px solid #E3EAE2;
              color:#254A38!important; font-size:14px!important; line-height:1.45!important;
            }
            .ep-roles-v2 .roles-mobile-card-permissions span:last-child { border:0; }
            .ep-roles-v2 .roles-mobile-card-permissions svg { flex-shrink:0; color:#3A8462; }
            .ep-roles-v2 .roles-mobile-delete {
              display:inline-flex; margin-top:14px!important; min-height:44px!important;
              border-radius:8px!important;
            }
            .ep-roles-v2 .roles-section-panel {
              margin-top:22px!important; border:0!important;
              background:#FFFEFC!important;
            }
            .ep-roles-v2 .roles-panel-header {
              padding:18px 16px!important; gap:12px;
              background:#E9EEE8!important; border-top:0!important;
              border-left:4px solid #3D6A53!important;
            }
            .ep-roles-v2 .roles-panel-header h2 {
              font-size:22px!important; line-height:1.21!important;
            }
            .ep-roles-v2 .roles-panel-header p { font-size:14px!important; }
            .ep-roles-v2 .roles-panel-inner { padding:19px 16px 22px!important; }
            .ep-roles-v2 .roles-field > span { font-size:14px!important; }
            .ep-roles-v2 .roles-field input, .ep-roles-v2 .roles-field textarea {
              border-radius:9px!important; border-color:#D7DDD7!important;
              min-height:50px!important; font-size:16px!important;
            }
            .ep-roles-v2 .roles-field textarea { min-height:82px!important; }
            .ep-roles-v2 .roles-permission-groups { gap:8px!important; }
            .ep-roles-v2 .roles-permission-group { border-radius:9px!important; overflow:hidden; }
            .ep-roles-v2 .roles-permission-group summary {
              min-height:57px!important; padding:11px!important;
              background:#F5F7F4!important;
            }
            .ep-roles-v2 .roles-permission-group summary span { font-size:14px!important; }
            .ep-roles-v2 .roles-permission-group summary small { font-size:12.5px!important; }
            .ep-roles-v2 #assign-access {
              background:#FFFFFF!important; border:0!important;
            }
            .ep-roles-v2 #assign-access .roles-panel-header {
              background:#E9F0F2!important; border:0!important;
              border-left:4px solid #517E8B!important;
            }
            .ep-roles-v2 #assign-access .roles-panel-header .roles-kicker { color:#416C7A!important; }
            .ep-roles-v2 #assign-access .roles-panel-header > svg { color:#416C7A!important; }
            .ep-roles-v2 #assign-access .roles-panel-inner { background:#FFFEFC!important; }
            .ep-roles-v2 .roles-host-control { border-color:#D3DDD9!important; }
            .ep-roles-v2 .roles-host-control > svg { color:#537568!important; }
            .ep-roles-v2 .roles-host-chevron {
              background:#173F35!important; border-left-color:#173F35!important;
            }
            .ep-roles-v2 .roles-host-chevron:hover,
            .ep-roles-v2 .roles-host-chevron:focus-visible { background:#275849!important; }
            .ep-roles-v2 .roles-audit {
              margin:20px 0 0!important; background:#E7EEE5!important;
              padding:18px 16px!important;
              border:0!important; border-left:4px solid #173F35!important;
              align-items:flex-start!important; flex-wrap:wrap;
            }
            .ep-roles-v2 .roles-audit h3 { font-size:18px!important; }
            .ep-roles-v2 .roles-audit-link { font-size:14px!important; }
          }
          /* On small screens, the task chooser reveals one functional work area at a time.
             Everything remains mounted; permission/form state and desktop flow are preserved. */
          @media (max-width:650px) {
            .ep-roles-v2[data-mobile-work-area="role-library"] #create-role,
            .ep-roles-v2[data-mobile-work-area="role-library"] #assign-access,
            .ep-roles-v2[data-mobile-work-area="create-role"] #role-library,
            .ep-roles-v2[data-mobile-work-area="create-role"] #assign-access,
            .ep-roles-v2[data-mobile-work-area="assign-access"] #role-library,
            .ep-roles-v2[data-mobile-work-area="assign-access"] #create-role {
              display:none!important;
            }
            .ep-roles-v2 .roles-step.is-current {
              background:#173F35!important; border-color:#173F35!important;
              color:#FFFFFF!important;
            }
            .ep-roles-v2 .roles-step.is-current .roles-step-num {
              background:#E3F0E5!important; color:#173F35!important;
            }
            .ep-roles-v2 .roles-step.is-current .roles-step-title { color:#FFFFFF!important; }
            .ep-roles-v2 #create-role, .ep-roles-v2 #assign-access { margin-top:10px!important; }
          }
          @media (max-width:359px) {
            .ep-roles-v2 .roles-mobile-card > summary { gap:7px; padding-inline:10px; }
            .ep-roles-v2 .roles-mobile-card-count { font-size:11px!important; }
          }
          @media (prefers-reduced-motion:reduce) {
            .ep-roles-v2 .roles-mobile-card-chevron { transition:none; }
          }
        `}</style>

        {rolesError ? (
          <div className="roles-error" role="alert">
            <CircleAlert size={19} />
            {getErrorMessage(rolesError)}{" "}
            <button
              className="roles-button roles-button-secondary"
              style={{ marginLeft: "auto" }}
              type="button"
              onClick={() => refetchRoles()}
            >
              Try again
            </button>
          </div>
        ) : null}

        <section className="roles-hero" aria-label="Admin access overview">
          <div className="roles-hero-main">
            <div className="roles-hero-kicker">ADMIN ACCESS</div>
            <h2>Give the right people the right access.</h2>
            <p>
              Review available roles, create one if needed, and assign it
              securely.
            </p>
          </div>
          <div className="roles-hero-stat">
            <strong>{rolesError ? "—" : roles.length}</strong>
            <span>Available roles</span>
          </div>
        </section>
        <nav className="roles-steps" aria-label="Role management steps">
          {[
            { number: "01", title: "Browse roles", href: "#role-library" },
            { number: "02", title: "Create a role", href: "#create-role" },
            { number: "03", title: "Assign access", href: "#assign-access" },
            { number: "04", title: "Review history", to: "/admin/audit" },
          ].map((step) => {
            const content = (
              <>
                <span className="roles-step-num">{step.number}</span>
                <span className="roles-step-title">{step.title}</span>
                <span className="roles-step-arrow" aria-hidden="true">
                  ↗
                </span>
              </>
            );
            return step.to ? (
              <Link className="roles-step" to={step.to} key={step.number}>
                {content}
              </Link>
            ) : (
              <a
                className={`roles-step${
                  mobileWorkArea === step.href.slice(1) ? " is-current" : ""
                }`}
                href={step.href}
                key={step.number}
                onClick={(event) => {
                  if (window.matchMedia("(max-width: 650px)").matches) {
                    event.preventDefault();
                    setMobileWorkArea(step.href.slice(1));
                  }
                }}
              >
                {content}
              </a>
            );
          })}
        </nav>

        <section className="roles-section" id="role-library">
          <div className="roles-section-head">
            <div>
              <span className="roles-kicker">01 / ROLE LIBRARY</span>
              <h2>Existing admin roles</h2>
              <p>Choose a ready-made role before creating a new one.</p>
            </div>
            <span className="roles-pill">
              {rolesError ? "Unavailable" : `${roles.length} roles`}
            </span>
          </div>
          <div className="roles-table-head">
            <span>Role</span>
            <span>Included access</span>
            <span>Action</span>
          </div>
          <div className="roles-list">
            {isLoadingRoles ? (
              <div
                style={{
                  padding: 25,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#173F35",
                }}
              >
                <LoaderCircle className="animate-spin" size={21} /> Loading
                roles…
              </div>
            ) : !roles.length && !rolesError ? (
              <p style={{ padding: 20, fontSize: 16, color: "#56645B" }}>
                No roles available.
              </p>
            ) : (
              roles.map((role, index) => {
                const roleKey = getRoleKey(role);
                const isSystem =
                  role?.isSystem === true || role?.system === true;
                const rolePermissions = Array.isArray(role?.permissionKeys)
                  ? role.permissionKeys
                  : [];
                return (
                  <article
                    id={`admin-role-${roleKey}`}
                    className={`roles-list-row${
                      highlightRoleKey === roleKey ? " roles-new-highlight" : ""
                    }`}
                    key={role.id || roleKey}
                  >
                    <div className="roles-desktop-cell">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <span className="roles-role-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <strong className="roles-role-name">
                          {role.name || roleKey}
                        </strong>
                        {isSystem ? (
                          <span className="roles-tag">EPANTRY</span>
                        ) : null}
                        {role.status === "disabled" ? (
                          <span className="roles-tag roles-tag-off">
                            Disabled
                          </span>
                        ) : null}
                      </div>
                      {role.description ? (
                        <p className="roles-role-desc">{role.description}</p>
                      ) : null}
                    </div>
                    <div className="roles-row-access roles-desktop-cell">
                      {rolePermissions.length ? (
                        <details className="roles-mobile-access">
                          <summary>
                            View {rolePermissions.length}{" "}
                            {rolePermissions.length === 1
                              ? "permission"
                              : "permissions"}{" "}
                            <ChevronDown size={15} aria-hidden="true" />
                          </summary>
                          <div className="roles-mobile-access-list">
                            {rolePermissions.map((permission) => (
                              <span key={permission}>
                                {titleizePermission(permission)}
                              </span>
                            ))}
                          </div>
                        </details>
                      ) : null}
                      {rolePermissions.length ? (
                        <>
                          <div className="roles-permission-preview">
                            {rolePermissions.slice(0, 3).map((permission) => (
                              <span key={permission}>
                                {titleizePermission(permission)}
                              </span>
                            ))}
                          </div>
                          {rolePermissions.length > 3 ? (
                            <details className="roles-permission-detail">
                              <summary>
                                View all {rolePermissions.length} permissions
                              </summary>
                              <div className="roles-all-permissions">
                                {rolePermissions.map((permission) => (
                                  <span key={permission}>
                                    {titleizePermission(permission)}
                                  </span>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ fontSize: 15, color: "#66756B" }}>
                          No delegated admin tools
                        </span>
                      )}
                    </div>
                    <div className="roles-desktop-cell">
                      {!isSystem ? (
                        <button
                          type="button"
                          disabled={isMutatingAdminControlPlane}
                          aria-label={`Delete ${role.name || roleKey}`}
                          onClick={() => {
                            setDeleteError("");
                            setRoleToDelete(role);
                          }}
                          className="roles-action"
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      ) : null}
                    </div>
                    <details className="roles-mobile-card">
                      <summary>
                        <span className="roles-mobile-card-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="roles-mobile-card-title">
                          <strong>{role.name || roleKey}</strong>
                          <span className="roles-mobile-card-subtitle">
                            {isSystem ? "EPANTRY role" : "Custom role"}
                            {role.status === "disabled" ? " · Disabled" : ""}
                          </span>
                        </span>
                        <span className="roles-mobile-card-count">
                          {rolePermissions.length}{" "}
                          {rolePermissions.length === 1
                            ? "permission"
                            : "permissions"}
                        </span>
                        <ChevronDown
                          className="roles-mobile-card-chevron"
                          size={18}
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="roles-mobile-card-body">
                        {role.description ? (
                          <p className="roles-mobile-card-desc">
                            {role.description}
                          </p>
                        ) : null}
                        {rolePermissions.length ? (
                          <div
                            className="roles-mobile-card-permissions"
                            aria-label={`Permissions for ${
                              role.name || roleKey
                            }`}
                          >
                            {rolePermissions.map((permission) => (
                              <span key={permission}>
                                <Check size={14} aria-hidden="true" />
                                {titleizePermission(permission)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="roles-mobile-card-desc">
                            No delegated admin tools
                          </p>
                        )}
                        {!isSystem ? (
                          <button
                            type="button"
                            disabled={isMutatingAdminControlPlane}
                            aria-label={`Delete ${role.name || roleKey}`}
                            onClick={() => {
                              setDeleteError("");
                              setRoleToDelete(role);
                            }}
                            className="roles-action roles-mobile-delete"
                          >
                            <Trash2 size={16} /> Delete custom role
                          </button>
                        ) : null}
                      </div>
                    </details>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="roles-section roles-section-panel" id="create-role">
          <header className="roles-panel-header">
            <div>
              <span className="roles-kicker">02 / CUSTOM ROLE</span>
              <h2>Create an admin role</h2>
              <p>Define the role and choose exactly which tools it can use.</p>
            </div>
            <ShieldCheck size={30} color="#173F35" aria-hidden="true" />
          </header>
          <form onSubmit={submitNewRole} className="roles-panel-inner">
            <div className="roles-form-grid">
              <label className="roles-field">
                <span>Internal role ID</span>
                <input
                  required
                  maxLength={64}
                  value={roleForm.key}
                  onChange={(event) => {
                    setRoleForm((current) => ({
                      ...current,
                      key: normalizeRoleKey(event.target.value),
                    }));
                    setCreateError("");
                  }}
                  placeholder="operations_support"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <label className="roles-field">
                <span>Role name</span>
                <input
                  required
                  value={roleForm.name}
                  onChange={(event) =>
                    setRoleForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Operations Support"
                />
              </label>
            </div>
            <label className="roles-field" style={{ marginTop: 18 }}>
              <span>Purpose</span>
              <textarea
                required
                minLength={2}
                maxLength={280}
                rows={2}
                value={roleForm.description}
                onChange={(event) =>
                  setRoleForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Describe what this role is responsible for"
              />
            </label>
            <div className="roles-matrix-top">
              <strong>Permissions</strong>
              <span>{roleForm.permissionKeys.length} selected</span>
            </div>
            {permissionsError ? (
              <div className="roles-error" role="alert">
                <CircleAlert size={18} />
                {getErrorMessage(permissionsError)}{" "}
                <button
                  className="roles-button roles-button-secondary"
                  style={{ marginLeft: "auto" }}
                  type="button"
                  onClick={() => refetchPermissions()}
                >
                  Try again
                </button>
              </div>
            ) : isLoadingPermissions ? (
              <div style={{ padding: 16 }}>
                <LoaderCircle
                  className="animate-spin"
                  size={22}
                  color="#173F35"
                />
              </div>
            ) : (
              <div className="roles-permission-groups">
                {groupedPermissions.map((group, index) => {
                  const selectedInGroup = group.permissions.filter(
                    (permission) =>
                      roleForm.permissionKeys.includes(
                        getPermissionKey(permission)
                      )
                  ).length;
                  return (
                    <details
                      className="roles-permission-group"
                      defaultOpen={index === 0}
                      key={group.id}
                    >
                      <summary>
                        <span>
                          {group.label}
                          <small>
                            {selectedInGroup} of {group.permissions.length}{" "}
                            selected
                          </small>
                        </span>
                      </summary>
                      <div className="group-items">
                        {group.permissions.map((permission) => {
                          const permissionKey = getPermissionKey(permission);
                          return (
                            <label
                              className="roles-checkbox-row"
                              key={permissionKey}
                            >
                              <input
                                type="checkbox"
                                checked={roleForm.permissionKeys.includes(
                                  permissionKey
                                )}
                                onChange={() => togglePermission(permissionKey)}
                              />
                              <span>
                                <span className="label-main">
                                  {titleizePermission(permissionKey)}
                                </span>
                                {permission.description ? (
                                  <span className="label-help">
                                    {permission.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
            {createError ? (
              <div className="roles-error" role="alert">
                <CircleAlert size={18} />
                {createError}
              </div>
            ) : null}
            <div className="roles-form-actions">
              <button
                type="submit"
                disabled={isMutatingAdminControlPlane}
                className="roles-button roles-button-primary"
              >
                {isMutatingAdminControlPlane ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <Plus size={17} />
                )}{" "}
                Create admin role
              </button>
            </div>
          </form>
        </section>

        <section
          className="roles-section roles-section-panel"
          id="assign-access"
        >
          <header className="roles-panel-header is-clay">
            <div>
              <span className="roles-kicker">03 / ASSIGN ACCESS</span>
              <h2>Choose a Host & assign access</h2>
              <p>
                Select an account and manage its admin roles without changing
                Host access.
              </p>
            </div>
            <Search size={29} color="#9A4F30" aria-hidden="true" />
          </header>
          <div className="roles-panel-inner">
            <div className="roles-host-picker" ref={hostPickerRef}>
              <label className="roles-host-label" htmlFor="admin-host-picker">
                Choose a Host
              </label>
              <div className="roles-host-control">
                <Search size={19} aria-hidden="true" />
                <input
                  id="admin-host-picker"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-expanded={hostPickerOpen}
                  aria-controls="admin-host-options"
                  aria-activedescendant={
                    hostPickerOpen && hostOptions[highlightedHost]
                      ? `admin-host-${hostOptions[highlightedHost].id}`
                      : undefined
                  }
                  value={hostQuery}
                  placeholder="Choose a Host or type to search"
                  autoComplete="off"
                  onFocus={() => setHostPickerOpen(true)}
                  onClick={() => setHostPickerOpen(true)}
                  onChange={(event) => changeHostQuery(event.target.value)}
                  onKeyDown={handleHostKeyboard}
                />
                <button
                  type="button"
                  className="roles-host-chevron"
                  aria-label={
                    hostPickerOpen ? "Close Host list" : "Show Host list"
                  }
                  aria-expanded={hostPickerOpen}
                  onClick={() => setHostPickerOpen((current) => !current)}
                >
                  <ChevronDown size={19} />
                </button>
              </div>
              {hostPickerOpen ? (
                <div className="roles-host-dropdown">
                  <div className="roles-host-dropdown-head">
                    <span>Host accounts</span>
                    <span>{hostTotal ? `${hostTotal} found` : ""}</span>
                  </div>
                  <div
                    id="admin-host-options"
                    className="roles-host-scroll"
                    role="listbox"
                    aria-label="Select Host account"
                  >
                    {hostOptions.map((host, index) => (
                      <button
                        type="button"
                        role="option"
                        id={`admin-host-${host.id}`}
                        key={host.id}
                        aria-selected={index === highlightedHost}
                        disabled={!host.canAssign}
                        className={`roles-host-option${
                          index === highlightedHost ? " is-highlighted" : ""
                        }`}
                        onMouseEnter={() => setHighlightedHost(index)}
                        onClick={() => selectHost(host)}
                      >
                        <span className="roles-host-avatar">
                          {String(host.name || "H")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="roles-host-option-name">
                            {host.name || "Unnamed Host"}
                          </span>
                          <span className="roles-host-option-email">
                            {host.email}
                          </span>
                        </span>
                        <span className="roles-host-status">
                          {host.canAssign ? host.hostAccessStatus : "Inactive"}
                        </span>
                        {selectedHost?.id === host.id ? (
                          <Check size={16} />
                        ) : null}
                      </button>
                    ))}
                    {isLoadingHosts && hostPage === 1 ? (
                      <div className="roles-host-empty">
                        <LoaderCircle size={17} className="animate-spin" />{" "}
                        Loading Hosts…
                      </div>
                    ) : null}
                    {!isLoadingHosts &&
                    !hostDirectoryError &&
                    !hostOptions.length ? (
                      <div className="roles-host-empty">
                        No matching Host accounts
                      </div>
                    ) : null}
                    {hostDirectoryError ? (
                      <div className="roles-host-empty" role="alert">
                        {hostDirectoryError}{" "}
                        <button
                          type="button"
                          className="roles-button roles-button-secondary"
                          onClick={() => setHostRetry((x) => x + 1)}
                        >
                          Try again
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {hostTotal > 10 && !hostDirectoryError ? (
                    <button
                      type="button"
                      className="roles-host-more"
                      onClick={openAllHosts}
                    >
                      <Users size={16} /> View all Hosts ({hostTotal}){" "}
                      <span aria-hidden="true">↗</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {selectedHost ? (
              <div className="roles-selected-host">
                <div>
                  <strong>{selectedHost.name}</strong>
                  <span>{selectedHost.email}</span>
                </div>
                <span>
                  Selected Host{" "}
                  <Check
                    size={15}
                    style={{ display: "inline", verticalAlign: "middle" }}
                  />
                </span>
              </div>
            ) : null}
            {selectedUserId ? (
              <div className="roles-assign-panel">
                {isLoadingAssignment ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={23}
                    color="#173F35"
                  />
                ) : assignmentLoadError ? (
                  <div className="roles-error" role="alert">
                    <CircleAlert size={18} />
                    {getErrorMessage(assignmentLoadError)}
                  </div>
                ) : (
                  <>
                    <div className="roles-assign-head">
                      <strong>
                        Choose admin roles for{" "}
                        {selectedHost?.name || "this Host"}
                      </strong>
                      <span>{selectedRoleKeys.length} selected</span>
                    </div>
                    <div className="roles-assign-list">
                      {assignableRoles.map((role) => {
                        const roleKey = getRoleKey(role);
                        const selected = selectedRoleKeys.includes(roleKey);
                        return (
                          <label className="roles-assign-row" key={roleKey}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRole(roleKey)}
                            />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <strong>{role.name || roleKey}</strong>
                              {role.description ? (
                                <p>{role.description}</p>
                              ) : null}
                            </span>
                            <span className="roles-status">
                              {selected ? "Selected" : "Add"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {assignmentError ? (
                      <div className="roles-error" role="alert">
                        <CircleAlert size={18} />
                        {assignmentError}
                      </div>
                    ) : null}
                    <div
                      className="roles-form-actions"
                      style={{ justifyContent: "flex-start", flexWrap: "wrap" }}
                    >
                      <button
                        type="button"
                        className="roles-button roles-button-primary"
                        onClick={saveAssignment}
                        disabled={
                          isMutatingAdminControlPlane ||
                          selectedRoleKeys.length === 0
                        }
                      >
                        {isMutatingAdminControlPlane ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <ShieldCheck size={17} />
                        )}
                        {assignment
                          ? "Save role changes"
                          : "Grant admin access"}
                      </button>
                      {assignment ? (
                        <button
                          type="button"
                          className="roles-button roles-button-danger"
                          onClick={revokeAssignment}
                          disabled={isMutatingAdminControlPlane}
                        >
                          Remove admin access
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {typeof document !== "undefined" && allHostsOpen
          ? createPortal(
              <div
                className="ep-hosts-modal-scrim"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setAllHostsOpen(false);
                }}
              >
                <section
                  className="ep-hosts-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ep-hosts-modal-title"
                >
                  <div className="ep-hosts-modal-head">
                    <div>
                      <span>03 / ASSIGN ACCESS</span>
                      <h2 id="ep-hosts-modal-title">All Host accounts</h2>
                    </div>
                    <button
                      type="button"
                      className="ep-hosts-modal-close"
                      aria-label="Close Host list"
                      onClick={() => setAllHostsOpen(false)}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="ep-hosts-modal-search">
                    <Search size={19} />
                    <input
                      ref={allHostSearchRef}
                      aria-label="Search Hosts"
                      value={allHostQuery}
                      onChange={(event) =>
                        changeAllHostQuery(event.target.value)
                      }
                      placeholder="Search Host name or email"
                    />
                    <span>{allHostTotal} Hosts</span>
                  </div>
                  <div
                    className="ep-hosts-modal-list"
                    onScroll={handleAllHostScroll}
                  >
                    {allHostOptions.map((host) => (
                      <button
                        type="button"
                        className="ep-hosts-modal-row"
                        key={host.id}
                        disabled={!host.canAssign}
                        onClick={() => selectHost(host)}
                      >
                        <span className="ep-hosts-modal-avatar">
                          {String(host.name || "H")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                        <span className="ep-hosts-modal-identity">
                          <strong>{host.name || "Unnamed Host"}</strong>
                          <small>{host.email}</small>
                        </span>
                        <span className="ep-hosts-modal-status">
                          {host.canAssign ? host.hostAccessStatus : "Inactive"}
                        </span>
                      </button>
                    ))}
                    {allHostLoading ? (
                      <div className="ep-hosts-modal-empty">
                        <LoaderCircle className="animate-spin" size={18} />{" "}
                        Loading Hosts…
                      </div>
                    ) : null}
                    {!allHostLoading &&
                    !allHostOptions.length &&
                    !allHostError ? (
                      <div className="ep-hosts-modal-empty">
                        No matching Hosts
                      </div>
                    ) : null}
                    {allHostError ? (
                      <div className="ep-hosts-modal-empty" role="alert">
                        {allHostError}
                        <button
                          type="button"
                          onClick={() => setAllHostRetry((x) => x + 1)}
                        >
                          Try again
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {allHostMore && !allHostError ? (
                    <div className="ep-hosts-modal-foot">
                      <button
                        disabled={allHostLoading}
                        type="button"
                        onClick={() => {
                          if (!allHostNextPageLock.current) {
                            allHostNextPageLock.current = true;
                            setAllHostPage((page) => page + 1);
                          }
                        }}
                      >
                        Load more Hosts ↓
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>,
              document.body
            )
          : null}

        {typeof document !== "undefined" && roleToDelete
          ? createPortal(
              <div
                className="ep-hosts-modal-scrim"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !deleteBusy)
                    setRoleToDelete(null);
                }}
              >
                <section
                  className="ep-role-delete-modal"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="ep-role-delete-title"
                  aria-describedby="ep-role-delete-copy"
                >
                  <div className="ep-role-delete-icon">
                    <Trash2 size={24} />
                  </div>
                  <h2 id="ep-role-delete-title">Delete custom role?</h2>
                  <p id="ep-role-delete-copy">
                    <strong>{roleToDelete.name}</strong> will be removed from
                    the role library. This cannot be undone. EPANTRY system
                    roles and roles with assignment references cannot be
                    deleted.
                  </p>
                  {deleteError ? (
                    <div className="ep-role-delete-error" role="alert">
                      {deleteError}
                    </div>
                  ) : null}
                  <div className="ep-role-delete-actions">
                    <button
                      type="button"
                      onClick={() => setRoleToDelete(null)}
                      disabled={deleteBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="ep-role-delete-confirm"
                      onClick={confirmDeleteRole}
                      disabled={deleteBusy}
                    >
                      {deleteBusy ? "Deleting…" : "Delete role"}
                    </button>
                  </div>
                </section>
              </div>,
              document.body
            )
          : null}

        <section className="roles-audit" aria-label="Audit history">
          <div>
            <span className="roles-kicker">04 / VERIFY</span>
            <h3>Review access changes</h3>
          </div>
          <Link className="roles-audit-link" to="/admin/audit">
            Open audit history →
          </Link>
        </section>
      </div>
    </AdminShell>
  );
}
