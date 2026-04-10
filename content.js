(function () {
    const BUTTON_ID = "cf-show-tags-btn";
    const BUTTON_WRAP_ID = "cf-show-tags-btn-wrap";
    const OUTPUT_ID = "cf-show-tags-output";
    const SAVED_DISPLAY_ATTR = "data-cf-show-tags-display";
    let problemsetCache = null;
    let mounted = false;

    // Avoid duplicate UI if script runs more than once.
    if (document.getElementById(BUTTON_ID)) return;

    function normalizeText(text) {
        return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
    }

    function findTagCaption() {
        const captions = document.querySelectorAll(".roundbox.sidebox .caption.titled, .caption.titled");

        for (const el of captions) {
            const text = normalizeText(el.textContent);
            if (text.includes("problem tags")) {
                return el;
            }
        }

        return null;
    }

    function parseProblemFromUrl() {
        const path = window.location.pathname;
        const patterns = [
            /^\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)\/?$/,
            /^\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)\/?$/,
            /^\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)\/?$/,
            /^\/group\/[^/]+\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)\/?$/
        ];

        for (const pattern of patterns) {
            const match = path.match(pattern);
            if (match) {
                return {
                    contestId: Number(match[1]),
                    index: String(match[2]).toUpperCase()
                };
            }
        }

        return null;
    }

    async function loadProblemset() {
        if (problemsetCache) return problemsetCache;

        const response = await fetch("https://codeforces.com/api/problemset.problems");
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }

        const payload = await response.json();
        if (payload.status !== "OK") {
            throw new Error("Codeforces API status is not OK");
        }

        problemsetCache = payload.result.problems || [];
        return problemsetCache;
    }

    function getOutputNode(hostNode, anchorNode) {
        let output = document.getElementById(OUTPUT_ID);
        if (output) return output;

        output = document.createElement("div");
        output.id = OUTPUT_ID;
        output.style.marginTop = "6px";
        output.style.fontSize = "12px";
        output.style.lineHeight = "1.4";
        output.style.color = "#333";
        output.style.padding = "0 0.5em 0.5em";

        if (anchorNode && anchorNode.nextSibling) {
            hostNode.insertBefore(output, anchorNode.nextSibling);
        } else {
            hostNode.appendChild(output);
        }

        return output;
    }

    function getNativeContentNodes(hostNode, captionNode) {
        const children = Array.from(hostNode.children);
        return children.filter(function (child) {
            return child !== captionNode && child.id !== OUTPUT_ID;
        });
    }

    function hideNativeContent(nodes) {
        for (const node of nodes) {
            if (!node.hasAttribute(SAVED_DISPLAY_ATTR)) {
                node.setAttribute(SAVED_DISPLAY_ATTR, node.style.display || "");
            }

            node.style.display = "none";
        }
    }

    function showNativeContent(nodes) {
        for (const node of nodes) {
            const savedDisplay = node.getAttribute(SAVED_DISPLAY_ATTR);
            node.style.display = savedDisplay === null ? "" : savedDisplay;
        }
    }

    function hasNativeTagBoxes(hostNode) {
        return !!hostNode.querySelector(".tag-box");
    }

    function mountButton() {
        if (mounted || document.getElementById(BUTTON_ID)) {
            mounted = true;
            return true;
        }

        const tagCaption = findTagCaption();
        if (!tagCaption) return false;

        const host = tagCaption.closest(".roundbox.sidebox") || tagCaption.parentElement || tagCaption;
        const nativeNodes = getNativeContentNodes(host, tagCaption);
        hideNativeContent(nativeNodes);

        const computedPosition = window.getComputedStyle(tagCaption).position;
        if (computedPosition === "static") {
            tagCaption.style.position = "relative";
        }

        if (!tagCaption.style.paddingRight) {
            tagCaption.style.paddingRight = "88px";
        }

        const button = document.createElement("button");
        button.id = BUTTON_ID;
        button.type = "button";
        button.textContent = "Show Tags";
        button.style.padding = "0 6px";
        button.style.height = "20px";
        button.style.cursor = "pointer";
        button.style.fontSize = "11px";
        button.style.lineHeight = "18px";

        let wrap = document.getElementById(BUTTON_WRAP_ID);
        if (!wrap) {
            wrap = document.createElement("span");
            wrap.id = BUTTON_WRAP_ID;
            wrap.style.position = "absolute";
            wrap.style.right = "6px";
            wrap.style.top = "2px";
            tagCaption.appendChild(wrap);
        }

        wrap.appendChild(button);

        let shown = false;

        button.addEventListener("click", async function () {
            const output = getOutputNode(host, tagCaption);

            if (shown) {
                hideNativeContent(nativeNodes);
                output.style.display = "none";
                button.textContent = "Show Tags";
                shown = false;
                return;
            }

            showNativeContent(nativeNodes);
            output.style.display = "none";

            if (hasNativeTagBoxes(host)) {
                button.textContent = "Hide Tags";
                shown = true;
                return;
            }

            const key = parseProblemFromUrl();

            if (!key) {
                output.style.display = "";
                output.textContent = "Cannot detect problem id from this URL.";
                button.textContent = "Hide Tags";
                shown = true;
                return;
            }

            button.disabled = true;
            button.textContent = "Loading...";
            output.textContent = "";

            try {
                const problems = await loadProblemset();
                const problem = problems.find(function (p) {
                    return Number(p.contestId) === key.contestId && String(p.index).toUpperCase() === key.index;
                });

                if (!problem) {
                    output.style.display = "";
                    output.textContent = "Tags not found for this problem.";
                    return;
                }

                if (!problem.tags || problem.tags.length === 0) {
                    output.style.display = "";
                    output.textContent = "No tags available for this problem.";
                    return;
                }

                output.style.display = "";
                output.textContent = "Tags: " + problem.tags.join(", ");
            } catch (error) {
                console.error("CF Show Tags error:", error);
                output.style.display = "";
                output.textContent = "Failed to load tags from Codeforces API.";
            } finally {
                button.disabled = false;
                button.textContent = "Hide Tags";
                shown = true;
            }
        });

        mounted = true;
        return true;
    }

    if (!mountButton()) {
        const observer = new MutationObserver(function () {
            if (mountButton()) {
                observer.disconnect();
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        setTimeout(function () {
            observer.disconnect();
        }, 10000);
    }
})();