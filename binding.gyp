{
  "targets": [
    {
      "target_name": "storekit",
      "sources": ["native/addon.cc"],
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET": "13.0",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++"
      },
      "conditions": [
        ["OS=='mac'", {
          "actions": [
            {
              "action_name": "build_swift",
              "inputs": [
                "swift/StoreKitBridge.swift",
                "swift/Payloads.swift",
                "swift/TransactionStore.swift",
                "swift/Listener.swift",
                "scripts/buildSwift.sh"
              ],
              "outputs": ["<(module_root_dir)/build/swift/libStoreKitBridge.a"],
              "action": ["sh", "scripts/buildSwift.sh", "<(module_root_dir)/build/swift"]
            }
          ],
          "libraries": ["<(module_root_dir)/build/swift/libStoreKitBridge.a"],
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "OTHER_LDFLAGS": [
              "-framework", "StoreKit",
              "-framework", "Foundation",
              "-L<!(xcrun --show-sdk-path)/usr/lib/swift",
              "-L<!(dirname $(xcrun --find swift))/../lib/swift/macosx",
              "-Wl,-rpath,/usr/lib/swift"
            ]
          }
        }]
      ]
    }
  ]
}
