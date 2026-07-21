"use strict";

/*
 * Use the Project URL and Publishable/Anon key.
 * NEVER place the Supabase service_role key in an HTML or JavaScript file.
 */
const SUPABASE_URL = "https://inefedzwwojzaptvdpwi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FQf-BhqQ-QX0CpxLO6scXQ__jK0URcH";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

function throwDatabaseError(error) {
  if (error) {
    console.error("Supabase error:", error);
    throw new Error(error.message || "Database request failed.");
  }
}

function normalizeRequest(row) {
  if (!row) return null;

  return {
    id: row.id,

    // Keep "row" for compatibility with your existing code.
    row: row.id,

    timestamp: row.created_at || "",
    email: row.email || "",
    dateRequested: row.date_requested || "",
    branch: row.branch || "",
    priceTagList: row.price_tag_list || "",
    notes: row.notes || "",
    status: row.status || "",
    emailSent: row.email_sent || false,
    printedEmailSent: row.printed_email_sent || false,
    selectedProducts: Array.isArray(row.selected_products)
      ? row.selected_products
      : []
  };
}

function normalizeProduct(row) {
  return {
    id: row.id,

    // Maintain compatibility with Generator.html.
    rowNumber: row.id,
    productKey: `PRODUCT_${row.id}`,

    name: row.name || "",
    arabicName: row.arabic_name || "",
    descriptionEN: row.description_en || "",
    descriptionAR: row.description_ar || "",
    price: row.price ?? "",
    symbol: row.symbol || "",
    netWeightEN: row.net_weight_en || "",
    netWeightAR: row.net_weight_ar || "",
    allergensEN: row.allergens_en || "",
    allergensAR: row.allergens_ar || "",
    category: (row.category || "").toUpperCase()
  };
}

/*
 * This preserves the existing apiCall("getProducts") structure,
 * so you do not need to rewrite the complete Generator.html.
 */
async function apiCall(action, params = {}) {
  switch (action) {
    case "getProducts": {
      const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("id", { ascending: true });

      throwDatabaseError(error);
      return (data || []).map(normalizeProduct);
    }

    case "getBranches": {
      const { data, error } = await supabaseClient
        .from("branches")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true });

      throwDatabaseError(error);

      // Existing HTML expects an array of branch names.
      return (data || []).map(branch => branch.name);
    }

    case "getHolidays": {
      const { data, error } = await supabaseClient
        .from("holidays")
        .select("id, name, date, emoji")
        .order("date", { ascending: true });

      throwDatabaseError(error);
      return data || [];
    }

    case "getRequests": {
      const { data, error } = await supabaseClient
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      throwDatabaseError(error);
      return (data || []).map(normalizeRequest);
    }

    case "getPendingRequests": {
      const requestedStatus = String(
        params.status || "PENDING"
      ).toUpperCase();

      const { data, error } = await supabaseClient
        .from("requests")
        .select("*")
        .eq("status", requestedStatus)
        .order("created_at", { ascending: false });

      throwDatabaseError(error);
      return (data || []).map(normalizeRequest);
    }

    case "getRequestData": {
      /*
       * Your existing Generator.html sends:
       * apiCall("getRequestData", { row: PRELOAD_ROW })
       *
       * The value will now be the Supabase request ID,
       * not the Google Sheet row number.
       */
      const requestId = Number(params.id || params.row);

      if (!Number.isInteger(requestId) || requestId <= 0) {
        throw new Error("Invalid request ID.");
      }

      const { data, error } = await supabaseClient
        .from("requests")
        .select("*")
        .eq("id", requestId)
        .single();

      throwDatabaseError(error);
      return normalizeRequest(data);
    }

    case "submitRequest": {
      let requestData = params;

      if (typeof params.payload === "string") {
        requestData = JSON.parse(params.payload);
      } else if (params.payload && typeof params.payload === "object") {
        requestData = params.payload;
      }

      const selectedProducts =
        requestData.selectedProducts ||
        requestData.selected_products ||
        [];

      const record = {
        email: String(requestData.email || "").trim(),
        date_requested:
          requestData.dateRequested ||
          requestData.date_requested ||
          new Date().toISOString().slice(0, 10),
        branch: String(requestData.branch || "").trim(),
        price_tag_list:
          requestData.priceTagList ||
          requestData.price_tag_list ||
          "",
        notes: String(requestData.notes || "").trim(),
        status: "PENDING",
        selected_products: selectedProducts
      };

      if (!record.email || !record.branch) {
        throw new Error("Email and branch are required.");
      }

      const { data, error } = await supabaseClient
        .from("requests")
        .insert(record)
        .select()
        .single();

      throwDatabaseError(error);

      return {
        success: true,
        request: normalizeRequest(data)
      };
    }

    case "updateRequestStatus": {
      const requestId = Number(params.id || params.row);
      const newStatus = String(params.status || "").toUpperCase();

      const allowedStatuses = [
        "PENDING",
        "IN PROGRESS",
        "PRINTED"
      ];

      if (!Number.isInteger(requestId) || requestId <= 0) {
        throw new Error("Invalid request ID.");
      }

      if (!allowedStatuses.includes(newStatus)) {
        throw new Error("Invalid request status.");
      }

      const { data, error } = await supabaseClient
        .from("requests")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", requestId)
        .select()
        .single();

      throwDatabaseError(error);
      return normalizeRequest(data);
    }

    case "verifyAdminLogin": {
      /*
       * Use the administrator's Supabase Auth email
       * in the existing username field.
       */
      const email = String(params.username || params.email || "").trim();
      const password = String(params.password || "");

      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error || !data.user) {
        return {
          authenticated: false,
          error: error?.message || "Invalid administrator login."
        };
      }

      return {
        authenticated: true,
        username: data.user.email,
        name:
          data.user.user_metadata?.name ||
          data.user.email
      };
    }

    case "logoutAdmin": {
      const { error } = await supabaseClient.auth.signOut();
      throwDatabaseError(error);
      return { success: true };
    }

    default:
      throw new Error(`Unknown Supabase action: ${action}`);
  }
}

window.supabaseClient = supabaseClient;
window.apiCall = apiCall;