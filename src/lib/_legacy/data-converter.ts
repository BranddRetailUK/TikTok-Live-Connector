import {
    CommonMessageData,
    Emote,
    User,
    WebcastChatMessage,
    WebcastEmoteChatMessage,
    WebcastEventMessage,
    WebcastGiftMessage,
    WebcastLinkMicBattle,
    WebcastQuestionNewMessage,
    WebcastRoomUserSeqMessage,
    WebcastSubEmote
} from '@/types';


/**
 * This ugly function brings the nested protobuf objects to a flat level
 * In addition, attributes in "Long" format are converted to strings (e.g. UserIds)
 * This makes it easier to handle the data later, since some libraries have problems to serialize this protobuf specific data.
 */
export function simplifyObject(
    type: keyof WebcastEventMessage,
    originalObject: any
): WebcastEventMessage & Record<string, any> {

    // Utility function for modifying types easily
    const simplify = <T extends any>(fn: (object: T & Record<string, any>) => any): T & Record<string, any> => fn(originalObject as T);

    if (originalObject.user) {
        originalObject = simplify<{ user: User }>((webcastObject) => {
            Object.assign(webcastObject, getUserAttributes(webcastObject.user));
            delete webcastObject.user;
            return webcastObject;
        });
    }

    if (originalObject.common) {
        originalObject = simplify<{ common: CommonMessageData }>((webcastObject) => {
            Object.assign(webcastObject, webcastObject.common.displayText);
            delete webcastObject.common.displayText;
            Object.assign(webcastObject, webcastObject.common);
            delete webcastObject.common;
            return webcastObject;
        });
    }

    switch (type) {
        case 'WebcastQuestionNewMessage': {
            originalObject = simplify<WebcastQuestionNewMessage>((webcastObject) => {
                Object.assign(webcastObject, webcastObject.details);
                delete webcastObject.details;
                return webcastObject;
            });
            break;
        }
        case 'WebcastRoomUserSeqMessage': {
            originalObject = simplify<WebcastRoomUserSeqMessage>((webcastObject) => {
                webcastObject.topViewers = getTopViewerAttributes(webcastObject.ranksList);
                delete webcastObject.ranksList;
                return webcastObject;
            });
            break;
        }
        case 'WebcastLinkMicBattle': {
            originalObject = simplify<WebcastLinkMicBattle>((webcastObject) => {
                const battleUsers = [];

                Object.values(webcastObject.anchorInfo).forEach((anchor) => {
                    if (anchor.user) {
                        battleUsers.push(getUserAttributes(anchor.user));
                    }
                });

                webcastObject.battleUsers = battleUsers;
                return webcastObject;
            });
            break;
        }
        case 'WebcastGiftMessage': {
            originalObject = simplify<WebcastGiftMessage & { repeatEnd: any }>((webcastObject) => {
                webcastObject.repeatEnd = !!webcastObject.repeatEnd;

                // Add previously used JSON structure (for compatibility reasons)
                // Can be removed soon <-- Will it ever be?
                webcastObject.gift = {
                    gift_id: webcastObject.giftId,
                    repeat_count: webcastObject.repeatCount,
                    repeat_end: webcastObject.repeatEnd ? 1 : 0,
                    gift_type: webcastObject.giftDetails?.giftType
                };

                if (webcastObject.giftDetails) {
                    Object.assign(webcastObject, webcastObject.giftDetails);
                    delete webcastObject.giftDetails;
                }

                if (webcastObject.giftDetails.giftImage) {
                    Object.assign(webcastObject, webcastObject.giftDetails.giftImage);
                    delete webcastObject.giftDetails.giftImage;
                }

                if (webcastObject.giftExtra) {

                    if (webcastObject.giftExtra.toUserId) {
                        webcastObject.receiverUserId = webcastObject.giftExtra.toUserId;
                        delete webcastObject.giftExtra.toUserId;
                    }

                    if (webcastObject.giftExtra.sendGiftSendMessageSuccessMs) {
                        webcastObject.timestamp = parseInt(webcastObject.giftExtra.sendGiftSendMessageSuccessMs);
                        delete webcastObject.giftExtra.sendGiftSendMessageSuccessMs;
                    }

                    Object.assign(webcastObject, webcastObject.giftExtra);
                    delete webcastObject.giftExtra;
                }

                if (webcastObject.monitorExtra?.indexOf('{') === 0) {
                    try {
                        webcastObject.monitorExtra = JSON.parse(webcastObject.monitorExtra);
                    } catch (err) {
                    }
                }

                return webcastObject;
            });
            break;
        }
        case 'WebcastChatMessage': {
            originalObject = simplify<WebcastChatMessage & { emotes: WebcastSubEmote & any }>((webcastObject) => {
                webcastObject.emotes = webcastObject.emotes.map((emote: WebcastSubEmote) => (
                    {
                        emoteId: emote.emote.emoteId,
                        emoteImageUrl: emote.emote.image.imageUrl,
                        placeInComment: emote.placeInComment
                    }
                ));
                return webcastObject;
            });
            break;
        }
        case 'WebcastEmoteChatMessage': {
            originalObject = simplify<WebcastEmoteChatMessage & { emotes: WebcastSubEmote & any }>((webcastObject) => {
                webcastObject.emotes = webcastObject.emoteList.map((emote: Emote) => (
                    {
                        emoteId: emote.emoteId,
                        emoteImageUrl: emote.image.url[0]
                    }
                ));
                return webcastObject;
            });
            break;
        }

    }

    return originalObject;
}

function getUserAttributes(webcastUser: Partial<User>): Record<string, any> {
    webcastUser ||= {};

    const userAttributes: Record<string, any> = {
        userId: webcastUser.userId?.toString(),
        secUid: webcastUser.secUid?.toString(),
        uniqueId: webcastUser.uniqueId !== '' ? webcastUser.uniqueId : undefined,
        nickname: webcastUser.nickname !== '' ? webcastUser.nickname : undefined,
        profilePictureUrl: getPreferredPictureFormat(webcastUser.profilePicture?.url),
        followRole: webcastUser.followInfo?.followStatus,
        userBadges: mapBadges(webcastUser.badges), // todo fix struct
        userSceneTypes: webcastUser.badges?.map((x) => x?.badgeScene || 0),
        userDetails: {
            createTime: webcastUser.createTime?.toString(),
            bioDescription: webcastUser.bioDescription,
            profilePictureUrls: webcastUser.profilePicture?.url
        }
    };

    if (webcastUser.followInfo) {
        userAttributes.followInfo = {
            followingCount: webcastUser.followInfo.followingCount,
            followerCount: webcastUser.followInfo.followerCount,
            followStatus: webcastUser.followInfo.followStatus,
            pushStatus: webcastUser.followInfo.pushStatus
        };
    }

    userAttributes.isModerator = userAttributes.userBadges.some((x) => (x.type && x.type.toLowerCase().includes('moderator')) || x.badgeSceneType === 1);
    userAttributes.isNewGifter = userAttributes.userBadges.some((x) => x.type && x.type.toLowerCase().includes('live_ng_'));
    userAttributes.isSubscriber = userAttributes.userBadges.some((x) => (x.url && x.url.toLowerCase().includes('/sub_')) || x.badgeSceneType === 4 || x.badgeSceneType === 7);
    userAttributes.topGifterRank =
        userAttributes.userBadges
            .find((x) => x.url && x.url.includes('/ranklist_top_gifter_'))
            ?.url.match(/(?<=ranklist_top_gifter_)(\d+)(?=.png)/g)
            ?.map(Number)[0] ?? null;

    userAttributes.gifterLevel = userAttributes.userBadges.find((x) => x.badgeSceneType === 8)?.level || 0; // BadgeSceneType_UserGrade
    userAttributes.teamMemberLevel = userAttributes.userBadges.find((x) => x.badgeSceneType === 10)?.level || 0; // BadgeSceneType_Fans

    return userAttributes;
}

export function getEventAttributes(event) {
    if (event.msgId) event.msgId = event.msgId.toString();
    if (event.createTime) event.createTime = event.createTime.toString();
    return event;
}

export function getTopViewerAttributes(topViewers) {
    return topViewers.map((viewer) => {
        return {
            user: viewer.user ? getUserAttributes(viewer.user) : null,
            coinCount: viewer.coinCount ? parseInt(viewer.coinCount) : 0
        };
    });
}

export function mapBadges(badges) {
    let simplifiedBadges = [];

    if (Array.isArray(badges)) {
        badges.forEach((innerBadges) => {
            let badgeSceneType = innerBadges.badgeSceneType;

            if (Array.isArray(innerBadges.badges)) {
                innerBadges.badges.forEach((badge) => {
                    simplifiedBadges.push(Object.assign({ badgeSceneType }, badge));
                });
            }

            if (Array.isArray(innerBadges.imageBadges)) {
                innerBadges.imageBadges.forEach((badge) => {
                    if (badge && badge.image && badge.image.url) {
                        simplifiedBadges.push({
                            type: 'image',
                            badgeSceneType,
                            displayType: badge.displayType,
                            url: badge.image.url
                        });
                    }
                });
            }

            if (innerBadges.privilegeLogExtra?.level && innerBadges.privilegeLogExtra?.level !== '0') {
                simplifiedBadges.push({
                    type: 'privilege',
                    privilegeId: innerBadges.privilegeLogExtra.privilegeId,
                    level: parseInt(innerBadges.privilegeLogExtra.level),
                    badgeSceneType: innerBadges.badgeSceneType
                });
            }
        });
    }

    return simplifiedBadges;
}

export function getPreferredPictureFormat(pictureUrls) {
    if (!pictureUrls || !Array.isArray(pictureUrls) || !pictureUrls.length) {
        return null;
    }

    return (
        pictureUrls.find((x) => x.includes('100x100') && x.includes('.webp')) ||
        pictureUrls.find((x) => x.includes('100x100') && x.includes('.jpeg')) ||
        pictureUrls.find((x) => !x.includes('shrink')) ||
        pictureUrls[0]
    );
}

