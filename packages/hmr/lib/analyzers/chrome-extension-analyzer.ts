/**
 * Chrome Extension HMR Compatibility Analyzer
 * 
 * Analyzes code to determine if it's compatible with Hot Module Replacement
 * or requires immediate synchronous execution (like Chrome Extension APIs)
 */

export interface HMRCompatibilityResult {
  isHMRCompatible: boolean;
  reasons: string[];
  recommendedStrategy: 'inline' | 'dynamic-import' | 'hybrid';
  chromeAPIUsage: {
    hasMessageListeners: boolean;
    hasStorageListeners: boolean;
    hasTabListeners: boolean;
    hasWindowListeners: boolean;
    hasNotificationListeners: boolean;
    immediateExecutionRequired: boolean;
  };
}

export interface HMRCompatibilityAnalyzer {
  analyze(code: string): HMRCompatibilityResult;
}

/**
 * Chrome Extension specific analyzer that detects patterns requiring immediate execution
 */
export class ChromeExtensionHMRAnalyzer implements HMRCompatibilityAnalyzer {
  private readonly chromeAPIPatterns = [
    // Runtime API patterns
    /chrome\.runtime\.onMessage\.addListener/g,
    /chrome\.runtime\.onConnect\.addListener/g,
    /chrome\.runtime\.onStartup\.addListener/g,
    /chrome\.runtime\.onInstalled\.addListener/g,
    /chrome\.runtime\.onSuspend\.addListener/g,
    /chrome\.runtime\.onUpdateAvailable\.addListener/g,
    
    // Storage API patterns
    /chrome\.storage\.onChanged\.addListener/g,
    /chrome\.storage\.sync\.onChanged\.addListener/g,
    /chrome\.storage\.local\.onChanged\.addListener/g,
    
    // Tabs API patterns
    /chrome\.tabs\.onCreated\.addListener/g,
    /chrome\.tabs\.onUpdated\.addListener/g,
    /chrome\.tabs\.onRemoved\.addListener/g,
    /chrome\.tabs\.onActivated\.addListener/g,
    
    // Windows API patterns
    /chrome\.windows\.onCreated\.addListener/g,
    /chrome\.windows\.onRemoved\.addListener/g,
    /chrome\.windows\.onFocusChanged\.addListener/g,
    
    // Notifications API patterns
    /chrome\.notifications\.onClicked\.addListener/g,
    /chrome\.notifications\.onClosed\.addListener/g,
    
    // WebNavigation API patterns
    /chrome\.webNavigation\.onBeforeNavigate\.addListener/g,
    /chrome\.webNavigation\.onCompleted\.addListener/g,
    
    // Content Script specific patterns
    /chrome\.runtime\.sendMessage/g,
    /chrome\.extension\.sendMessage/g,
  ];

  private readonly immediateExecutionPatterns = [
    // Content script global assignments that must happen immediately
    /window\.\w+\s*=/g,
    /globalThis\.\w+\s*=/g,
    
    // Document ready patterns that need immediate registration
    /document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]|['"]load['"]|['"]ready['"]/g,
    
    // Window event patterns
    /window\.addEventListener\s*\(\s*['"]load['"]|['"]beforeunload['"]|['"]unload['"]/g,
    
    // Manifest V3 specific patterns
    /chrome\.action\.onClicked\.addListener/g,
    /chrome\.contextMenus\.onClicked\.addListener/g,
  ];

  private readonly uiComponentPatterns = [
    // React component patterns
    /export\s+(?:default\s+)?(?:function|const)\s+\w+.*(?:React\.FC|FunctionComponent|Component)/g,
    /import.*from\s+['"]react['"]/g,
    /useState|useEffect|useCallback|useMemo|useContext/g,
    
    // JSX patterns
    /<\w+.*>/g,
    /jsx|tsx/g,
    
    // CSS/Style patterns
    /import.*\.css['"];?$/gm,
    /import.*\.scss['"];?$/gm,
    /import.*\.less['"];?$/gm,
    /styled\.|makeStyles\(|useStyles\(/g,
  ];

  analyze(code: string): HMRCompatibilityResult {
    const chromeAPIUsage = this.analyzeChromeAPIUsage(code);
    const hasImmediateExecution = this.hasImmediateExecutionRequirements(code);
    const hasUIComponents = this.hasUIComponentPatterns(code);
    
    const reasons: string[] = [];
    let recommendedStrategy: 'inline' | 'dynamic-import' | 'hybrid' = 'dynamic-import';
    
    // Determine if HMR is compatible
    const isHMRCompatible = !chromeAPIUsage.immediateExecutionRequired && !hasImmediateExecution;
    
    if (chromeAPIUsage.immediateExecutionRequired) {
      reasons.push('Contains Chrome API listeners that require immediate execution');
      recommendedStrategy = 'inline';
    }
    
    if (hasImmediateExecution) {
      reasons.push('Contains code patterns requiring immediate execution on script load');
      recommendedStrategy = 'inline';
    }
    
    if (hasUIComponents && !chromeAPIUsage.immediateExecutionRequired) {
      reasons.push('Contains UI components that benefit from HMR');
      recommendedStrategy = isHMRCompatible ? 'dynamic-import' : 'hybrid';
    }
    
    if (isHMRCompatible) {
      reasons.push('Code is compatible with Hot Module Replacement');
    }

    return {
      isHMRCompatible,
      reasons,
      recommendedStrategy,
      chromeAPIUsage,
    };
  }

  private analyzeChromeAPIUsage(code: string) {
    const usage = {
      hasMessageListeners: false,
      hasStorageListeners: false,
      hasTabListeners: false,
      hasWindowListeners: false,
      hasNotificationListeners: false,
      immediateExecutionRequired: false,
    };

    // Check for message listeners
    if (/chrome\.runtime\.onMessage\.addListener|chrome\.extension\.sendMessage/.test(code)) {
      usage.hasMessageListeners = true;
      usage.immediateExecutionRequired = true;
    }

    // Check for storage listeners  
    if (/chrome\.storage\..*\.onChanged\.addListener/.test(code)) {
      usage.hasStorageListeners = true;
      usage.immediateExecutionRequired = true;
    }

    // Check for tabs listeners
    if (/chrome\.tabs\..*\.addListener/.test(code)) {
      usage.hasTabListeners = true;
      usage.immediateExecutionRequired = true;
    }

    // Check for windows listeners
    if (/chrome\.windows\..*\.addListener/.test(code)) {
      usage.hasWindowListeners = true;
      usage.immediateExecutionRequired = true;
    }

    // Check for notification listeners
    if (/chrome\.notifications\..*\.addListener/.test(code)) {
      usage.hasNotificationListeners = true;
      usage.immediateExecutionRequired = true;
    }

    // Check for any Chrome API pattern that requires immediate execution
    const hasAnyChromeAPIListener = this.chromeAPIPatterns.some(pattern => {
      pattern.lastIndex = 0; // Reset regex state
      return pattern.test(code);
    });

    if (hasAnyChromeAPIListener) {
      usage.immediateExecutionRequired = true;
    }

    return usage;
  }

  private hasImmediateExecutionRequirements(code: string): boolean {
    return this.immediateExecutionPatterns.some(pattern => {
      pattern.lastIndex = 0; // Reset regex state
      return pattern.test(code);
    });
  }

  private hasUIComponentPatterns(code: string): boolean {
    return this.uiComponentPatterns.some(pattern => {
      pattern.lastIndex = 0; // Reset regex state
      return pattern.test(code);
    });
  }
}

/**
 * Factory function to create analyzer instance
 */
export function createChromeExtensionAnalyzer(): HMRCompatibilityAnalyzer {
  return new ChromeExtensionHMRAnalyzer();
}