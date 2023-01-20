import { PLUGIN_CONTEXT } from "./context";
import { validateConfiguration } from "./util/config";

export async function beforeRunHook(runDetails: Cypress.BeforeRunDetails) {
    validateConfiguration(runDetails.config.env);
}

export async function afterRunHook(
    results:
        | CypressCommandLine.CypressRunResult
        | CypressCommandLine.CypressFailedRunResult
) {
    console.log("┌───────────────────────────┐");
    console.log("│                           │");
    console.log("│    Cypress Xray Plugin    │");
    console.log("│                           │");
    console.log("└───────────────────────────┘");
    if (results.status === "failed") {
        console.error(
            `Aborting: failed to run ${results.failures} tests:`,
            results.message
        );
        return;
    }
    await PLUGIN_CONTEXT.client.importExecutionResults(
        results as CypressCommandLine.CypressRunResult
    );
}

export async function filePreprocessorHook(file: Cypress.FileObject) {
    return "C:\\Repositories\\cypress-xray-plugin\\README.md";
}
