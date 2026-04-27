"use client"

import { useState, useEffect } from "react"
import { Search, Calendar, Trash2, Loader2, Edit2, Eye, Printer, Film, ShoppingBag, Drama } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { useRouter } from "next/navigation"
import { logger } from '@/lib/logger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// --- FIREBASE IMPORTS ---
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

type AuditionStatus = "Completed" | "Processing" | "Draft"

interface Audition {
  id: string
  project: string  // Maps to what used to be "genre"
  role: string     // Maps to what used to be "title"
  date: string
  status: AuditionStatus
  projectType?: "cinematic" | "commercial" | "theater"
  analysisType: "sides" | "brief"
  castingDirectorName?: string
}

const filters: Array<"All" | AuditionStatus> = ["All", "Draft", "Processing", "Completed"]

/**
 * Renders a colored badge displaying the audition status.
 * @param status - The audition status to display (Completed, Processing, or Draft)
 * @returns The styled status badge element
 */
function StatusBadge({ status }: { status: AuditionStatus }) {
  const colors: Record<AuditionStatus, string> = {
    Completed: "bg-[#4A5548]/60 text-[#D4DDD6]",
    Processing: "bg-[#4A5548]/60 text-[#D4DDD6]",
    Draft: "bg-[#F5F0E8]/20 text-[#F5F0E8]/70",
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  )
}

/**
 * Main auditions list page component.
 * Displays user's auditions with search, filtering, and CRUD operations.
 * @returns The rendered auditions list page
 */
export default function AuditionsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<"All" | AuditionStatus>("All")
  
  // Dynamic State
  const [auditionList, setAuditionList] = useState<Audition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userPath, setUserPath] = useState<string | null>(null)

  const router = useRouter()
  const [editingAudition, setEditingAudition] = useState<Audition | null>(null)
  const [editForm, setEditForm] = useState({ 
    project: "", 
    role: "", 
    projectType: "cinematic" as "cinematic" | "commercial" | "theater" ,
    castingDirectorName: "",
    status: "Draft" as AuditionStatus
  })

  /**
   * INITIALIZATION & AUTH LISTENER
   * Waits for user login, constructs the safe userPath, and triggers the database fetch.
   */
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const firstName = user.displayName ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "Actor";
        const path = `${user.uid}_${firstName}`;
        setUserPath(path);
        fetchAuditions(path);
      } else {
        setUserPath(null);
        setAuditionList([]);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Fetches all audition documents from Firestore for the specified user path.
   * @param path - The user's unique path (uid_firstName format)
   * @returns void (side effects: updates auditionList and isLoading state)
   * @async
   */
  const fetchAuditions = async (path: string) => {
    try {
      setIsLoading(true);
      const db = getDb();
      const auditionsRef = collection(db, `users/${path}/auditions`);
      
      // We order by createdAt so the newest auditions appear at the top
      const q = query(auditionsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const fetchedData: Audition[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        
        // Format the Firestore Timestamp into a readable string (e.g., "Oct 14, 2025")
        let formattedDate = "Unknown Date";
        if (data.createdAt) {
          const dateObj = data.createdAt.toDate();
          formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }

        // Standardize status text (Firestore may store lowercase or title-case)
        const rawStatus = (data.status || "").toLowerCase();
        let statusStr: AuditionStatus = "Draft";
        if (rawStatus === "completed") statusStr = "Completed";
        else if (rawStatus === "processing") statusStr = "Processing";

        return {
          id: docSnap.id,
          project: data.project || "Untitled Project",
          role: data.role || "Unknown Role",
          date: formattedDate,
          status: statusStr,
          projectType: data.projectType || "cinematic",
          analysisType: data.analysisType || "sides",
          castingDirectorName: data.castingDirectorName || ""
        };
      });

      setAuditionList(fetchedData);
    } catch (error) {
      logger.error({ err: error, msg: 'Error fetching auditions' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Updates audition metadata (project, role, projectType) in Firestore.
   * @returns void (side effects: updates Firestore doc and local auditionList state)
   * @async
   */
  const handleUpdate = async () => {
    if (!editingAudition || !userPath) return;
    try {
      const db = getDb();
      const docRef = doc(db, `users/${userPath}/auditions/${editingAudition.id}`);
      
      await updateDoc(docRef, {
        project: editForm.project,
        role: editForm.role,
        projectType: editForm.projectType, 
        castingDirectorName: editForm.castingDirectorName,
        status: editForm.status.toLowerCase()
      });

      // Update the local screen instantly
      setAuditionList((prev) => prev.map((a) => 
        a.id === editingAudition.id ? { ...a, ...editForm } : a
      ));
      
      // Close the modal
      setEditingAudition(null);
    } catch (error) {
      logger.error({ err: error, msg: 'Failed to update audition' });
      alert("Error saving changes.");
    }
  }

  /**
   * Navigates to the audition detail view for the specified audition.
   * @param id - The unique identifier of the audition to view
   * @returns void (side effect: router navigation)
   */
  const handleView = (id: string) => {
    router.push(`/auditions/${id}`);
  }

  /**
   * Navigates to the audition detail view with a print action parameter.
   * @param id - The unique identifier of the audition to print
   * @returns void (side effect: router navigation with print query param)
   */
  const handlePrint = (id: string) => {
    // Navigates to the view page and passes a print command in the URL
    router.push(`/auditions/${id}?action=print`);
  }

  /**
   * Deletes an audition document from Firestore and removes it from local state.
   * @param id - The unique identifier of the audition to delete
   * @returns void (side effects: deletes Firestore doc and updates auditionList)
   * @async
   */
  const handleDelete = async (id: string) => {
    if (!userPath) return;

    try {
      // 1. Delete from Firebase
      const db = getDb();
      const docRef = doc(db, `users/${userPath}/auditions/${id}`);
      await deleteDoc(docRef);

      // 2. Remove from local screen (so the user doesn't have to refresh)
      setAuditionList((prev) => prev.filter((a) => a.id !== id));
      
    } catch (error) {
      logger.error({ err: error, msg: 'Error deleting audition' });
      alert("Failed to delete audition. Please try again.");
    }
  }

  // Filter logic
  const filteredAuditions = auditionList.filter((a) => {
    const matchesSearch =
      a.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.role.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "All" || a.status === activeFilter
    return matchesSearch && matchesFilter
  })

  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="Auditions List" />

      {/* --- EDIT MODAL OVERLAY --- */}
      {editingAudition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#F0E8DC] p-8 rounded-2xl w-full max-w-md shadow-2xl border border-[#C7C0B5]">
            <h2 className="text-2xl font-title text-[#2C3328] mb-6">Edit Audition Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#FF7316] uppercase tracking-wider">Project Name</label>
                <input 
                  type="text" 
                  value={editForm.project}
                  onChange={(e) => setEditForm({...editForm, project: e.target.value})}
                  className="w-full mt-1 bg-white border border-[#C7C0B5] rounded-lg px-4 py-2 text-[#2C3328] focus:border-[#E8721A] outline-none"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-[#FF7316] uppercase tracking-wider">Role</label>
                <input 
                  type="text" 
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  className="w-full mt-1 bg-white border border-[#C7C0B5] rounded-lg px-4 py-2 text-[#2C3328] focus:border-[#E8721A] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#FF7316] uppercase tracking-wider">Casting Director Name</label>
                <input 
                  type="text" 
                  value={editForm.castingDirectorName}
                  onChange={(e) => setEditForm({...editForm, castingDirectorName: e.target.value})}
                  placeholder="e.g., John Doe"
                  className="w-full mt-1 bg-white border border-[#C7C0B5] rounded-lg px-4 py-2 text-[#2C3328] focus:border-[#E8721A] outline-none"
                />
              </div>

              {/* status badge*/}
              <div>
                <label className="text-xs font-medium text-[#FF7316] uppercase tracking-wider">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value as AuditionStatus})}
                  className="w-full mt-1 bg-white border border-[#C7C0B5] rounded-lg px-4 py-2 text-[#2C3328] focus:border-[#E8721A] outline-none appearance-none cursor-pointer"
                >
                  <option value="Draft">Draft</option>
                  <option value="Processing">Processing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#FF7316] uppercase tracking-wider">Project Type</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <button 
                    onClick={() => setEditForm({...editForm, projectType: "cinematic"})}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${editForm.projectType === "cinematic" ? "bg-[#E8721A] text-white border-[#E8721A]" : "bg-white text-[#6B6B6B] border-[#C7C0B5]"}`}
                  >
                    <Film className="w-4 h-4" /> Cinematic
                  </button>
                  <button 
                    onClick={() => setEditForm({...editForm, projectType: "commercial"})}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${editForm.projectType === "commercial" ? "bg-[#E8721A] text-white border-[#E8721A]" : "bg-white text-[#6B6B6B] border-[#C7C0B5]"}`}
                  >
                    <ShoppingBag className="w-4 h-4" /> Commercial
                  </button>
                  <button 
                    onClick={() => setEditForm({...editForm, projectType: "theater"})}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors text-sm ${editForm.projectType === "theater" ? "bg-[#E8721A] text-white border-[#E8721A]" : "bg-white text-[#6B6B6B] border-[#C7C0B5]"}`}
                  >
                    <Drama className="w-4 h-4" /> Theater
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 justify-end">
              <button 
                onClick={() => setEditingAudition(null)}
                className="px-5 py-2 rounded-full text-sm font-medium text-[#6B6B6B] hover:bg-[#E8DFD0] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdate}
                className="px-5 py-2 rounded-full text-sm font-medium bg-[#4A5548] text-[#D4DDD6] hover:bg-[#3D4A3C] transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ------------------------- */}

      {/* Search & Filter */}
      <div className="flex items-center gap-4 px-8 pb-6">
        <div className="relative flex-1 max-w-[60%]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
          <input
            type="text"
            placeholder="Search auditions by project or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#C7C0B5] bg-[#F5F0E8] py-2.5 pl-10 pr-4 text-sm text-[#2C3328] placeholder-[#6B6B6B] outline-none focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
        </div>
        <div className="flex items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? "bg-[#E8721A] text-[#ffffff]"
                  : "text-[#2C3328] hover:bg-[#E8DFD0]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#E8721A]" />
        </div>
      ) : filteredAuditions.length === 0 ? (
        
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <h3 className="text-xl font-title text-[#2C3328] mb-2">No auditions found</h3>
          <p className="text-[#6B6B6B] max-w-md">
            You haven't generated any character breakdowns yet, or none match your current filters.
          </p>
        </div>

      ) : (

        /* Audition Cards Grid */
        <div className="grid grid-cols-1 gap-5 px-8 pb-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredAuditions.map((audition) => (
            <div
              key={audition.id}
              className="relative flex flex-col justify-between rounded-2xl bg-[#3D4A3C] p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Status badge */}
              <div className="absolute top-4 right-4">
                <StatusBadge status={audition.status} />
              </div>

              {/* Clickable Header Area to View */}
              <div 
                className="pr-16 cursor-pointer group" 
                onClick={() => handleView(audition.id)}
              > 
                <div className="flex items-center gap-2 mb-1">
                  {audition.projectType === "commercial" ? (
                    <ShoppingBag className="w-3.5 h-3.5 text-[#E8721A]" />
                  ) : audition.projectType === "theater" ? (
                    <Drama className="w-3.5 h-3.5 text-[#E8721A]" />
                  ) : (
                    <Film className="w-3.5 h-3.5 text-[#E8721A]" />
                  )}
                  <p className="text-xs text-[#E8721A] uppercase tracking-wide font-semibold">
                    {audition.projectType || "cinematic"}
                  </p>
                  <span className="ml-2 px-2 py-0.5 rounded-sm bg-[#4A5548]/60 text-[#D4DDD6] border border-[#4A5548] text-[10px] uppercase tracking-wider font-medium">
                    {audition.analysisType}
                  </span>
                </div>
                <h3 className="font-title text-xl font-bold text-white truncate group-hover:text-[#E8721A] transition-colors">
                  {audition.project}
                </h3>
                <p className="mt-1 text-sm text-[#F5F0E8]/70 truncate">{audition.role}</p>
              </div>

              {/* Bottom Action Row */}
              <div className="mt-6 flex items-center justify-between border-t border-[#F5F0E8]/10 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-[#F5F0E8]/60">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{audition.date}</span>
                </div>
                
                {/* ACTION ICON BUTTONS */}
                <div className="flex items-center gap-1 z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleView(audition.id); }}
                    className="p-2 text-[#F5F0E8]/40 hover:text-white transition-colors rounded-full hover:bg-white/10"
                    title="View Breakdown"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingAudition(audition);
                      setEditForm({ 
                        project: audition.project, 
                        role: audition.role, 
                        projectType: audition.projectType || "cinematic", 
                        castingDirectorName: audition.castingDirectorName || "",
                        status: audition.status 
                      });
                    }}
                    className="p-2 text-[#F5F0E8]/40 hover:text-[#E8721A] transition-colors rounded-full hover:bg-white/10"
                    title="Edit Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePrint(audition.id); }}
                    className="p-2 text-[#F5F0E8]/40 hover:text-white transition-colors rounded-full hover:bg-white/10"
                    title="Print"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {/* Delete Dialog */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 text-[#F5F0E8]/40 hover:text-[#C45A3C] transition-colors rounded-full hover:bg-[#C45A3C]/10"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-title text-[#2C3328]">Delete Audition</AlertDialogTitle>
                        <AlertDialogDescription className="text-[#6B6B6B]">
                          Are you sure you want to delete &quot;{audition.project}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0]">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(audition.id)}
                          className="bg-[#C45A3C] text-[#ffffff] hover:bg-[#C45A3C]/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>

          ))}
        </div>
      )}
    </main>
  )
}
   