// C surface of the Swift bridge in swift/StoreKitBridge.swift.
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

// Exactly one of `json` / `error` is non-null. Called on a background thread.
typedef void (*storekit_reply)(void *context, const char *json, const char *error);

void storekit_products(const char *identifiers_json, void *context, storekit_reply reply);
void storekit_purchase(const char *product_id, const char *app_account_token, void *context, storekit_reply reply);
void storekit_finish(const char *transaction_id, void *context, storekit_reply reply);
void storekit_current_entitlements(void *context, storekit_reply reply);
void storekit_sync(void *context, storekit_reply reply);
void storekit_listen(storekit_reply reply);
void storekit_stop_listening(void);

#ifdef __cplusplus
}
#endif
