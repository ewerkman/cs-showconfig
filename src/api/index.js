import axios from "axios";
import xml2js from "xml2js";
import sortJsonArray from "sort-json-array";
import _ from "underscore";

export function getMetaData(config, headers, context) {
  axios
    .get(config.EngineUri + "/commerceops/$metadata", headers)
    .then(response => {
      xml2js.parseString(response.data, (err, result) => {
        console.log(err);
        context.commit(
          "setSchema",
          result["edmx:Edmx"]["edmx:DataServices"][0]["Schema"]
        );
      });
    })
    .catch(error => {
      context.commit("setConnectionError", true);
    });
}

export function getEnvironments(config, headers, context) {
  context.commit("addLoadMessage", "Loading environments");
  axios
    .get(config.EngineUri + "/commerceops/Environments", {
      headers: headers
    })
    .then(response => {
      // Relplace policysets references with actual poiicy set
      var policySets = [];
      var environments = response.data.value;
      _.each(environments, (environment, envIndex) => {
        console.log(environment.Name);
        var policies = environment.Policies;
        _.each(policies, (policy, policyIndex) => {
          if (
            policy["@odata.type"] === "#Sitecore.Commerce.Core.PolicySetPolicy"
          ) {
            var policySetName = policy.PolicySetId.substring(
              policy.PolicySetId.lastIndexOf("-") + 1
            );
            var headers = {
              Authorization: context.state.token,
              "Content-Type": "application/json"
            };
            axios
              .get(
                context.state.config.EngineUri +
                  `/api/PolicySets('${policySetName}')`,
                {
                  headers: headers
                }
              )
              .then(response => {
                var policySet = response.data;
                context.commit("setPolicySet", {
                  policySet: policySet,
                  environmentName: environment.Name
                });
                //environments[envIndex].Policies[policyIndex] = policySet;
              });
          }
        });
      });

      context.commit("setEnvironments", environments);
      context.commit("addLoadMessage", "Loaded environments");
    })
    .catch(error => {
      context.commit("setConnectionError", true);
    });
}

export function getPlugins(config, headers, context) {
  context.commit("addLoadMessage", "Loading plugins");
  axios
    .get(config.EngineUri + "/commerceops/RunningPlugins()", {
      headers: headers
    })
    .then(response => {
      context.commit("setPlugins", response.data.value);
      context.commit("addLoadMessage", "Loaded plugins");
    })
    .catch(error => {
      context.commit("setConnectionError", true);
    });
}

export function getPipelines(config, headers, context) {
  context.commit("addLoadMessage", "Loading pipelines.");
  axios
    .get(config.EngineUri + "/commerceops/GetPipelines()", {
      headers: headers
    })
    .then(response => {
      var pipelines = sortJsonArray(response.data.List, "Namespace");
      var namespaces = [];
      var pipelineNames = [];
      var blocks = [];

      pipelines.forEach(pipeline => {
        if (!namespaces.includes(pipeline.Namespace)) {
          namespaces.unshift(pipeline.Namespace);
        }
        pipelineNames.unshift(`${pipeline.Namespace}.${pipeline.Name}`);

        pipeline.Blocks.forEach(block => {
          var blockName = `${block.Namespace}.${block.Name}`;
          var existingBlock = blocks.find(element => {
            return `${element.Namespace}.${element.Name}` === blockName;
          });
          if (!existingBlock) {
            blocks.unshift(block);
          }
        });
      });

      context.commit("setPipelines", pipelines);
      context.commit("setBlocks", blocks);
      context.commit("setFinishedLoading", true);

      context.commit("addLoadMessage", "Loaded pipelines");
    });
}
