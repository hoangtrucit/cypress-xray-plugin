import FormData from "form-data";
import fs from "fs";
import { BasicAuthCredentials, HTTPHeader, PATCredentials } from "../../authentication/credentials";
import { ImportExecutionResultsConverterServer } from "../../conversion/importExecutionResults/importExecutionResultsConverterServer";
import { Requests } from "../../https/requests";
import { logError, logInfo, logSuccess } from "../../logging/logging";
import { XrayTestExecutionResultsServer } from "../../types/xray/importTestExecutionResults";
import {
    ExportCucumberTestsResponse,
    ServerImportCucumberTestsResponse,
} from "../../types/xray/responses";
import { XrayClient } from "./xrayClient";

export class XrayClientServer extends XrayClient<BasicAuthCredentials | PATCredentials> {
    private readonly apiBaseURL: string;

    /**
     * Construct a new Xray Server client.
     *
     * @param apiBaseURL the Xray server base endpoint
     * @param credentials the credentials to use during authentication
     */
    constructor(apiBaseURL: string, credentials: BasicAuthCredentials | PATCredentials) {
        super(credentials);
        this.apiBaseURL = apiBaseURL;
    }

    protected async dispatchImportTestExecutionResultsRequest(
        results: CypressCommandLine.CypressRunResult
    ): Promise<string | null> {
        const json: XrayTestExecutionResultsServer =
            new ImportExecutionResultsConverterServer().convertExecutionResults(results);
        if (!json.tests || json.tests.length === 0) {
            return null;
        }
        return this.credentials
            .getAuthenticationHeader()
            .catch((error: unknown) => {
                logError(`Failed to authenticate: "${error}"`);
                this.writeErrorFile(error, "authenticationError");
                throw error;
            })
            .then(async (header: HTTPHeader) => {
                logInfo(`Uploading test results to ${this.apiBaseURL}...`);
                const progressInterval = this.startResponseInterval(this.apiBaseURL);
                try {
                    const response = await Requests.post(
                        `${this.apiBaseURL}/rest/raven/latest/api/import/execution`,
                        json,
                        {
                            headers: {
                                ...header,
                            },
                        }
                    );
                    logSuccess(
                        `Successfully uploaded test execution results to ${response.data.testExecIssue.key}.`
                    );
                    return response.data.testExecIssue.key;
                } finally {
                    clearInterval(progressInterval);
                }
            });
    }

    protected dispatchExportCucumberTestsRequest(
        keys?: string,
        filter?: number
    ): Promise<ExportCucumberTestsResponse> {
        throw new Error("Method not implemented.");
    }

    protected async dispatchImportCucumberTestsRequest(
        file: string,
        projectKey?: string
    ): Promise<ServerImportCucumberTestsResponse> {
        const header = await this.credentials.getAuthenticationHeader();
        logInfo("Importing cucumber feature files...");
        const progressInterval = setInterval(() => {
            logInfo("Still importing...");
        }, 5000);
        try {
            const fileContent = fs.createReadStream(file);
            const form = new FormData();
            form.append("file", fileContent);

            const response = await Requests.post<FormData>(
                `${this.apiBaseURL}/rest/raven/latest/import/feature?projectKey=${projectKey}`,
                form,
                {
                    headers: {
                        ...header,
                        ...form.getHeaders(),
                    },
                }
            );
            // Happens when scenarios cause errors in Xray.
            // E.g. typos in Gherkin keywords ('Scenariot').
            if ("message" in response.data) {
                if (response.data.testIssues.length > 0) {
                    logSuccess(
                        "Successfully updated or created test issues:",
                        JSON.stringify(response.data.testIssues)
                    );
                }
                if (response.data.preConditionIssues.length > 0) {
                    logSuccess(
                        "Successfully updated or created precondition issues:",
                        JSON.stringify(response.data.preConditionIssues)
                    );
                }
            } else {
                logSuccess(
                    "Successfully updated or created issues:",
                    JSON.stringify(response.data)
                );
            }
            return response.data;
        } finally {
            clearInterval(progressInterval);
        }
    }
}
