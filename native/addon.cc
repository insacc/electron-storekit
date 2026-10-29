// Node-API layer: turns each one-shot Swift reply into a Promise that settles
// with the raw JSON string, and the transaction listener into calls of one JS
// function. Parsing and typing happen in src/.
#include <napi.h>

#include <mutex>
#include <string>

#include "StoreKitBridge.h"

namespace {

struct Reply {
  std::string json;
  std::string error;
  bool failed;
};

struct Request {
  Napi::Promise::Deferred deferred;
  Napi::ThreadSafeFunction function;
};

Napi::Function Noop(Napi::Env env) {
  return Napi::Function::New(env, [](const Napi::CallbackInfo &) {});
}

void SettleRequest(void *context, const char *json, const char *error) {
  auto *request = static_cast<Request *>(context);
  auto *reply = new Reply{json ? json : "", error ? error : "", error != nullptr};
  Napi::ThreadSafeFunction function = request->function;
  function.BlockingCall(reply, [request](Napi::Env env, Napi::Function, Reply *reply) {
    if (reply->failed) {
      auto rejection = Napi::Error::New(env, "StoreKit bridge error");
      rejection.Set("payload", Napi::String::New(env, reply->error));
      request->deferred.Reject(rejection.Value());
    } else {
      request->deferred.Resolve(Napi::String::New(env, reply->json));
    }
    delete reply;
    delete request;
  });
  function.Release();
}

// Builds the request a Swift call settles; the caller passes it as context.
Request *NewRequest(Napi::Env env) {
  return new Request{Napi::Promise::Deferred::New(env),
                     Napi::ThreadSafeFunction::New(env, Noop(env), "storekit", 0, 1)};
}

std::string StringArgument(const Napi::CallbackInfo &info, size_t index) {
  if (info.Length() <= index || !info[index].IsString()) {
    throw Napi::TypeError::New(info.Env(), "Expected a string argument");
  }
  return info[index].As<Napi::String>().Utf8Value();
}

Napi::Value Products(const Napi::CallbackInfo &info) {
  std::string identifiers = StringArgument(info, 0);
  Request *request = NewRequest(info.Env());
  Napi::Promise promise = request->deferred.Promise();
  storekit_products(identifiers.c_str(), request, SettleRequest);
  return promise;
}

Napi::Value Purchase(const Napi::CallbackInfo &info) {
  std::string productId = StringArgument(info, 0);
  bool hasToken = info.Length() > 1 && info[1].IsString();
  std::string token = hasToken ? info[1].As<Napi::String>().Utf8Value() : "";
  Request *request = NewRequest(info.Env());
  Napi::Promise promise = request->deferred.Promise();
  storekit_purchase(productId.c_str(), hasToken ? token.c_str() : nullptr, request, SettleRequest);
  return promise;
}

Napi::Value Finish(const Napi::CallbackInfo &info) {
  std::string transactionId = StringArgument(info, 0);
  Request *request = NewRequest(info.Env());
  Napi::Promise promise = request->deferred.Promise();
  storekit_finish(transactionId.c_str(), request, SettleRequest);
  return promise;
}

Napi::Value CurrentEntitlements(const Napi::CallbackInfo &info) {
  Request *request = NewRequest(info.Env());
  Napi::Promise promise = request->deferred.Promise();
  storekit_current_entitlements(request, SettleRequest);
  return promise;
}

Napi::Value Sync(const Napi::CallbackInfo &info) {
  Request *request = NewRequest(info.Env());
  Napi::Promise promise = request->deferred.Promise();
  storekit_sync(request, SettleRequest);
  return promise;
}

std::mutex listenerMutex;
Napi::ThreadSafeFunction listener;
bool listening = false;

void DeliverTransaction(void *, const char *json, const char *) {
  std::lock_guard<std::mutex> guard(listenerMutex);
  if (!listening || json == nullptr) {
    return;
  }
  auto *payload = new std::string(json);
  listener.BlockingCall(payload, [](Napi::Env env, Napi::Function callback, std::string *payload) {
    callback.Call({Napi::String::New(env, *payload)});
    delete payload;
  });
}

void StopListening() {
  storekit_stop_listening();
  std::lock_guard<std::mutex> guard(listenerMutex);
  if (listening) {
    listener.Release();
    listening = false;
  }
}

Napi::Value Listen(const Napi::CallbackInfo &info) {
  if (info.Length() < 1 || !info[0].IsFunction()) {
    throw Napi::TypeError::New(info.Env(), "Expected a listener function");
  }
  StopListening();
  {
    std::lock_guard<std::mutex> guard(listenerMutex);
    listener = Napi::ThreadSafeFunction::New(info.Env(), info[0].As<Napi::Function>(), "storekit-listener", 0, 1);
    // A listener alone must not keep a Node process alive.
    listener.Unref(info.Env());
    listening = true;
  }
  storekit_listen(DeliverTransaction);
  return info.Env().Undefined();
}

Napi::Value StopListeningBinding(const Napi::CallbackInfo &info) {
  StopListening();
  return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("products", Napi::Function::New(env, Products));
  exports.Set("purchase", Napi::Function::New(env, Purchase));
  exports.Set("finish", Napi::Function::New(env, Finish));
  exports.Set("currentEntitlements", Napi::Function::New(env, CurrentEntitlements));
  exports.Set("sync", Napi::Function::New(env, Sync));
  exports.Set("listen", Napi::Function::New(env, Listen));
  exports.Set("stopListening", Napi::Function::New(env, StopListeningBinding));
  return exports;
}

}  // namespace

NODE_API_MODULE(storekit, Init)
