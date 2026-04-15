(function () {
    const BUTTON_ID = "cf-show-tags-btn";
    const RATING_BUTTON_ID = "cf-show-rating-btn";
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

    async function loadProblem(key) {
        const problems = await loadProblemset();
        return (
            problems.find(function (p) {
                return Number(p.contestId) === key.contestId && String(p.index).toUpperCase() === key.index;
            }) || null
        );
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

    function syncCaptionPadding(captionNode, wrapNode) {
        if (!captionNode || !wrapNode) return;

        const wrapWidth = Math.ceil(wrapNode.getBoundingClientRect().width);
        captionNode.style.paddingRight = Math.max(88, wrapWidth + 8) + "px";
    }

    function hasNativeTagBoxes(nodes) {
        for (const node of nodes) {
            if (node.classList && node.classList.contains("tag-box")) {
                return true;
            }

            if (node.querySelector && node.querySelector(".tag-box")) {
                return true;
            }
        }

        return false;
    }

    function parseRatingText(text) {
        const match = String(text || "")
            .trim()
            .match(/^\*(\d+)$/);
        return match ? match[1] : null;
    }

    function findNativeRatingTag(nodes) {
        for (const node of nodes) {
            const candidates = [];

            if (node.classList && node.classList.contains("tag-box")) {
                candidates.push(node);
            }

            if (node.querySelectorAll) {
                candidates.push(...node.querySelectorAll(".tag-box"));
            }

            for (const candidate of candidates) {
                const rating = parseRatingText(candidate.textContent);
                if (rating) {
                    return {
                        value: rating,
                        node: candidate
                    };
                }
            }
        }

        return null;
    }

    function applyFallbackRatingStyle(chip) {
        chip.style.display = "inline-block";
        chip.style.padding = "1px 7px";
        chip.style.border = "1px solid #b8b8b8";
        chip.style.borderRadius = "8px";
        chip.style.background = "#efefef";
        chip.style.color = "#222";
        chip.style.boxShadow = "inset 0 1px 0 #fff";
        chip.style.lineHeight = "1.2";
        chip.style.textDecoration = "none";
        chip.style.verticalAlign = "middle";
    }

    function buildRatingChip(ratingValue, templateNode) {
        const useAnchor = !!(templateNode && templateNode.tagName && templateNode.tagName.toLowerCase() === "a");
        const chip = document.createElement(useAnchor ? "a" : "span");
        chip.className = "tag-box";
        chip.textContent = "*" + String(ratingValue);
        chip.removeAttribute("id");

        if (useAnchor) {
            chip.href =
                templateNode.getAttribute("href") || "/problemset?tags=%2A" + encodeURIComponent(String(ratingValue));
        }

        let appliedNativeStyle = false;
        if (templateNode && window.getComputedStyle) {
            const style = window.getComputedStyle(templateNode);
            if (style) {
                chip.style.display = "inline-block";
                chip.style.padding = style.padding;
                chip.style.border = style.border;
                chip.style.borderRadius = style.borderRadius;
                chip.style.background = style.background;
                chip.style.color = style.color;
                chip.style.fontSize = style.fontSize;
                chip.style.fontWeight = style.fontWeight;
                chip.style.lineHeight = style.lineHeight;
                chip.style.boxShadow = style.boxShadow;
                chip.style.textDecoration = "none";
                chip.style.verticalAlign = style.verticalAlign;
                appliedNativeStyle = style.borderStyle !== "none" && style.borderWidth !== "0px";
            }
        }

        if (!appliedNativeStyle) {
            applyFallbackRatingStyle(chip);
        }

        // Keep rating chip shape closer to CF tag boxes (rounded rectangle, not pill).
        chip.style.padding = "1px 7px";
        chip.style.borderRadius = "8px";

        return chip;
    }

    function showRatingOnly(output, ratingValue, templateNode) {
        output.style.display = "";
        output.textContent = "";

        const chip = buildRatingChip(ratingValue, templateNode);
        output.appendChild(chip);
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
        button.style.margin = "0";
        button.style.cursor = "pointer";
        button.style.fontSize = "11px";
        button.style.lineHeight = "18px";

        const ratingButton = document.createElement("button");
        ratingButton.id = RATING_BUTTON_ID;
        ratingButton.type = "button";
        ratingButton.textContent = "Rating";
        ratingButton.style.padding = "0 6px";
        ratingButton.style.height = "20px";
        ratingButton.style.margin = "0";
        ratingButton.style.cursor = "pointer";
        ratingButton.style.fontSize = "11px";
        ratingButton.style.lineHeight = "18px";

        let wrap = document.getElementById(BUTTON_WRAP_ID);
        if (!wrap) {
            wrap = document.createElement("span");
            wrap.id = BUTTON_WRAP_ID;
            wrap.style.position = "absolute";
            wrap.style.right = "6px";
            wrap.style.top = "2px";
            wrap.style.display = "inline-flex";
            wrap.style.alignItems = "center";
            wrap.style.gap = "2px";
            tagCaption.appendChild(wrap);
        }

        wrap.appendChild(button);
        wrap.appendChild(ratingButton);
        syncCaptionPadding(tagCaption, wrap);

        let shown = false;
        let ratingShown = false;

        ratingButton.addEventListener("click", async function () {
            if (shown) return;

            const output = getOutputNode(host, tagCaption);

            if (ratingShown) {
                output.style.display = "none";
                output.textContent = "";
                ratingShown = false;
                return;
            }

            ratingButton.disabled = true;
            ratingButton.textContent = "Loading...";
            output.style.display = "none";
            output.textContent = "";

            try {
                const nativeRating = findNativeRatingTag(nativeNodes);
                let rating = nativeRating ? nativeRating.value : null;
                const templateNode = nativeRating ? nativeRating.node : null;

                if (!rating) {
                    const key = parseProblemFromUrl();

                    if (!key) {
                        output.style.display = "";
                        output.textContent = "Cannot detect problem id from this URL.";
                        return;
                    }

                    const problem = await loadProblem(key);
                    if (!problem || problem.rating === undefined || problem.rating === null) {
                        output.style.display = "";
                        output.textContent = "Rating not found for this problem.";
                        return;
                    }

                    rating = String(problem.rating);
                }

                showRatingOnly(output, rating, templateNode);
                ratingShown = true;
            } catch (error) {
                console.error("CF Show Tags rating error:", error);
                output.style.display = "";
                output.textContent = "Failed to load rating from Codeforces API.";
                ratingShown = false;
            } finally {
                ratingButton.disabled = false;
                ratingButton.textContent = "Rating";
            }
        });

        button.addEventListener("click", async function () {
            const output = getOutputNode(host, tagCaption);

            if (shown) {
                hideNativeContent(nativeNodes);
                output.style.display = "none";
                output.textContent = "";
                button.textContent = "Show Tags";
                shown = false;
                ratingShown = false;
                ratingButton.style.display = "";
                syncCaptionPadding(tagCaption, wrap);
                return;
            }

            ratingButton.style.display = "none";
            ratingShown = false;
            syncCaptionPadding(tagCaption, wrap);

            showNativeContent(nativeNodes);
            output.style.display = "none";
            output.textContent = "";

            if (hasNativeTagBoxes(nativeNodes)) {
                button.textContent = "Hide Tags";
                shown = true;
                syncCaptionPadding(tagCaption, wrap);
                return;
            }

            const key = parseProblemFromUrl();

            if (!key) {
                output.style.display = "";
                output.textContent = "Cannot detect problem id from this URL.";
                button.textContent = "Hide Tags";
                shown = true;
                syncCaptionPadding(tagCaption, wrap);
                return;
            }

            button.disabled = true;
            button.textContent = "Loading...";
            output.textContent = "";

            try {
                const problem = await loadProblem(key);

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
                syncCaptionPadding(tagCaption, wrap);
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
