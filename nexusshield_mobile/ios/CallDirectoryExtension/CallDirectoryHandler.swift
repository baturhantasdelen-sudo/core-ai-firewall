import Foundation
import CallKit

/// Add this file to a Call Directory Extension target in Xcode (File → New → Target → Call Directory Extension).
/// Bundle ID example: com.nexusshield.guard.CallDirectory
final class CallDirectoryHandler: CXCallDirectoryProvider {
  override func beginRequest(with context: CXCallDirectoryExtensionContext) {
    context.delegate = self
    addBlockingPhoneNumbers(to: context)
    context.completeRequest()
  }

  private func addBlockingPhoneNumbers(to context: CXCallDirectoryExtensionContext) {
    let defaults = UserDefaults(suiteName: "group.com.nexusshield.guard")
    let numbers = defaults?.stringArray(forKey: "nexus_call_block_list") ?? []
    var parsed: [CXCallDirectoryPhoneNumber] = []
    for raw in numbers {
      let digits = raw.filter { $0.isNumber }
      if let value = Int64(digits) {
        parsed.append(value)
      }
    }
    parsed.sort()
    for phone in parsed {
      context.addBlockingEntry(withNextSequentialPhoneNumber: phone)
    }
  }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
  func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
    NSLog("CallDirectory reload failed: \(error.localizedDescription)")
  }
}
